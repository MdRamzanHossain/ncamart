import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService } from "@/modules/logistics";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor, params }) => {
    const { id } = (await params) as { id: string };
    const label = await logisticsService.getShippingLabel(id, actor!);
    return NextResponse.json(label, { status: 200 });
  }
);
