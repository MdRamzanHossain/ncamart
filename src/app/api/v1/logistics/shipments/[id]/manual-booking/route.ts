import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService, manualBookingSchema } from "@/modules/logistics";

export const POST = withRoute(
  {
    auth: "staff",
    schema: manualBookingSchema,
  },
  async ({ actor, body, params }) => {
    const { id } = (await params) as { id: string };
    const result = await logisticsService.manualBooking(id, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
