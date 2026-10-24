import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { trustService, assertCanAuditSampling } from "@/modules/trust";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor }) => {
    assertCanAuditSampling(actor);
    const queue = await trustService.getSamplingQueue(actor!);
    return NextResponse.json(queue, { status: 200 });
  }
);
