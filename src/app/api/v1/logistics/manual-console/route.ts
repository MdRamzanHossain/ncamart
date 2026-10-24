import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService } from "@/modules/logistics";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor }) => {
    const consoleData = await logisticsService.getManualConsole(actor!);
    return NextResponse.json(consoleData, { status: 200 });
  }
);
