import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  assertCanRunRunner,
} from "@/modules/sourcing";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor }) => {
    assertCanRunRunner(actor);
    const session = await sourcingService.getCurrentFloatSession(actor!);
    return NextResponse.json({ session }, { status: 200 });
  }
);
