import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import {
  reportsService,
  renderReportToFormat,
  financePolicies,
  ReportQuerySchema,
  NINETY_DAYS_MS,
} from "@/modules/finance";

const VALID_REPORTS = [
  "trial-balance",
  "profit-and-loss",
  "courier-receivable-aging",
  "customer-deposits",
  "store-credit-liability",
  "runner-float-status",
  "supplier-payables",
  "vat-sales-register",
  "refunds-register",
  "kpi-operations",
] as const;

export const GET = withRoute(
  {
    auth: "staff",
    params: z.object({
      reportType: z.string(),
    }),
    query: ReportQuerySchema,
  },
  async ({ params, query, actor }) => {
    // Check permission: ledger.read or reports.export or role FINANCE_OFFICER / SUPER_ADMIN
    if (!financePolicies.canReadReports(actor)) {
      throw new ForbiddenError(
        "Insufficient permissions: requires ledger.read or reports.export permission"
      );
    }

    const { reportType } = params;
    if (!VALID_REPORTS.includes(reportType as (typeof VALID_REPORTS)[number])) {
      throw new ValidationError(
        `Unknown report type '${reportType}'. Valid types: ${VALID_REPORTS.join(", ")}`
      );
    }

    // Check if range exceeds 90 days -> trigger background heavy export job
    if (query.from && query.to) {
      const fromDate = new Date(query.from);
      const toDate = new Date(query.to);
      const rangeMs = toDate.getTime() - fromDate.getTime();

      if (rangeMs > NINETY_DAYS_MS) {
        const job = await reportsService.createExportJob(
          {
            reportType,
            format: query.format,
            queryParams: {
              from: query.from,
              to: query.to,
              asOf: query.asOf,
            },
          },
          actor!
        );

        return NextResponse.json(
          {
            success: true,
            isHeavyReport: true,
            message:
              "Report range exceeds 90 days. Export job dispatched to background worker.",
            exportJob: job,
          },
          { status: 202 }
        );
      }
    }

    // Synchronous execution for <= 90 days
    const reportData = await reportsService.runReport(reportType, query);
    const format = query.format ?? "json";

    if (format === "json") {
      return NextResponse.json(reportData, { status: 200 });
    }

    // CSV with UTF-8 BOM or XLSX spreadsheet streaming
    const rendered = renderReportToFormat(reportType, reportData, format);

    return new Response(rendered.buffer, {
      status: 200,
      headers: {
        "Content-Type": rendered.contentType,
        "Content-Disposition": `attachment; filename="${rendered.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }
);
