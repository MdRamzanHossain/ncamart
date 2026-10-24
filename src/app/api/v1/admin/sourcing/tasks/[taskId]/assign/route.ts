import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  runnerTaskAssignSchema,
  assertCanManageSourcingTasks,
} from "@/modules/sourcing";

const paramsSchema = z.object({
  taskId: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
    body: runnerTaskAssignSchema,
  },
  async ({ params, body, actor }) => {
    assertCanManageSourcingTasks(actor);
    const updated = await sourcingService.assignTask(params.taskId, body, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);
