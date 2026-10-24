import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService, packOrderSchema } from "@/modules/logistics";

export const POST = withRoute(
  {
    auth: "staff",
    schema: packOrderSchema,
  },
  async ({ actor, body, params }) => {
    const { orderId } = (await params) as { orderId: string };
    const result = await logisticsService.packOrder(orderId, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
