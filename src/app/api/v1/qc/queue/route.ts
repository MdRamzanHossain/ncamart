import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { trustService, assertCanExecuteQc } from "@/modules/trust";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor }) => {
    assertCanExecuteQc(actor);
    const queue = await trustService.getQcQueue(actor!);
    return NextResponse.json(queue, { status: 200 });
  }
);
