import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  floatSignoffSchema,
  assertCanSignoffFloat,
} from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: floatSignoffSchema.optional(),
  },
  async ({ body, params, actor }) => {
    assertCanSignoffFloat(actor);
    const id = (params as { id: string }).id;
    const session = await sourcingService.signoffFloatSession(id, actor!, body);
    return NextResponse.json(session, { status: 200 });
  }
);
