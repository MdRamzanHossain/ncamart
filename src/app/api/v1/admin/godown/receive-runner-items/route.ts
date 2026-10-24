import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  receiveRunnerItemsSchema,
  assertCanReceiveGodown,
} from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: receiveRunnerItemsSchema,
  },
  async ({ body, actor }) => {
    assertCanReceiveGodown(actor);
    const result = await sourcingService.receiveRunnerItems(body.task_ids, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
