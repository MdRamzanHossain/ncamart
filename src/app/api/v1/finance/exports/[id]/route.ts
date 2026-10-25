import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";
import {
  reportsService,
  financePolicies,
} from "@/modules/finance";

export const GET = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  async ({ params, actor }) => {
    if (!financePolicies.canExportReports(actor) && !financePolicies.canReadReports(actor)) {
      throw new ForbiddenError(
        "Insufficient permissions: requires reports.export or ledger.read permission"
      );
    }

    const job = await reportsService.getExportSignedUrl(params.id, actor!);
    return NextResponse.json(
      {
        success: true,
        exportJob: job,
      },
      { status: 200 }
    );
  }
);
