import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService } from "@/modules/logistics";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor }) => {
    const queue = await logisticsService.getDispatchQueue(actor!);
    return NextResponse.json(queue, { status: 200 });
  }
);
