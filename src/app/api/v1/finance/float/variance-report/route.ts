import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  assertCanManageFloat,
} from "@/modules/sourcing";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor }) => {
    assertCanManageFloat(actor);
    const report = await sourcingService.getFloatVarianceReport(actor!);
    return NextResponse.json({ report }, { status: 200 });
  }
);
