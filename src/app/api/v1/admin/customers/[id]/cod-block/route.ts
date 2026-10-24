import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService, codBlockOverrideSchema } from "@/modules/logistics";

export const POST = withRoute(
  {
    auth: "staff",
    schema: codBlockOverrideSchema,
  },
  async ({ actor, body, params }) => {
    const { id } = (await params) as { id: string };
    const result = await logisticsService.overrideCodBlock(id, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
