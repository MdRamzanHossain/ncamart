import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  listFloatSessionsFilterSchema,
  assertCanReadFloat,
} from "@/modules/sourcing";

export const GET = withRoute(
  {
    auth: "staff",
    query: listFloatSessionsFilterSchema,
  },
  async ({ query, actor }) => {
    assertCanReadFloat(actor);
    const result = await sourcingService.listFloatSessions(query, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
