import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  issueFloatSchema,
  assertCanManageFloat,
} from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: issueFloatSchema,
  },
  async ({ body, actor }) => {
    assertCanManageFloat(actor);
    const session = await sourcingService.issueFloatSession(body, actor!);
    return NextResponse.json(session, { status: 201 });
  }
);
