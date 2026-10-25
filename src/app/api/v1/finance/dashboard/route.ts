import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { financeService } from "@/modules/finance";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor }) => {
    const summary = await financeService.getDashboardCounts(actor!);
    return NextResponse.json(summary, { status: 200 });
  }
);
