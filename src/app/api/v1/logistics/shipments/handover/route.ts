import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService, handoverSchema } from "@/modules/logistics";

export const POST = withRoute(
  {
    auth: "staff",
    schema: handoverSchema,
  },
  async ({ actor, body }) => {
    const result = await logisticsService.handoverShipments(body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
