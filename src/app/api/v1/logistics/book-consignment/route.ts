import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService, bookConsignmentSchema } from "@/modules/logistics";

export const POST = withRoute(
  {
    auth: "staff",
    schema: bookConsignmentSchema,
  },
  async ({ actor, body }) => {
    const result = await logisticsService.bookConsignment(body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
