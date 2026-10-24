import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { sourcingService, assertCanManageSourcingTasks } from "@/modules/sourcing";

const paramsSchema = z.object({
  taskId: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    assertCanManageSourcingTasks(actor);
    const updated = await sourcingService.acknowledgeTask(params.taskId, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);
