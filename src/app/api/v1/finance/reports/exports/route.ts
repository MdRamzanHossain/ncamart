import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";
import {
  reportsService,
  financePolicies,
  CreateExportJobInputSchema,
} from "@/modules/finance";

export const POST = withRoute(
  {
    auth: "staff",
    body: CreateExportJobInputSchema,
  },
  async ({ body, actor }) => {
    if (!financePolicies.canExportReports(actor) && !financePolicies.canReadReports(actor)) {
      throw new ForbiddenError(
        "Insufficient permissions: requires reports.export or ledger.read permission"
      );
    }

    const job = await reportsService.createExportJob(body, actor!);
    return NextResponse.json(
      {
        success: true,
        exportJob: job,
      },
      { status: 201 }
    );
  }
);
