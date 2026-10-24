import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  countFloatSchema,
  assertCanManageFloat,
} from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: countFloatSchema,
  },
  async ({ body, params, actor }) => {
    assertCanManageFloat(actor);
    const id = (params as { id: string }).id;
    const session = await sourcingService.countFloatSession(id, body, actor!);
    return NextResponse.json(session, { status: 200 });
  }
);
