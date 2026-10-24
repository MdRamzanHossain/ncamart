import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  returnFloatSchema,
  assertCanRunRunner,
} from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: returnFloatSchema.optional(),
  },
  async ({ body, actor }) => {
    assertCanRunRunner(actor);
    const session = await sourcingService.returnFloatSession(actor!, body);
    return NextResponse.json(session, { status: 200 });
  }
);
