import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService, rtoReceiveSchema } from "@/modules/logistics";

export const POST = withRoute(
  {
    auth: "staff",
    schema: rtoReceiveSchema,
  },
  async ({ actor, body, params }) => {
    const { shipmentId } = (await params) as { shipmentId: string };
    const result = await logisticsService.receiveRto(shipmentId, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
