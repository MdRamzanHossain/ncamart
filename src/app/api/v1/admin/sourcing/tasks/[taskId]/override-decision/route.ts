import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  runnerTaskOverrideDecisionSchema,
  assertCanManageSourcingTasks,
} from "@/modules/sourcing";

const paramsSchema = z.object({
  taskId: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
    body: runnerTaskOverrideDecisionSchema,
  },
  async ({ params, body, actor }) => {
    assertCanManageSourcingTasks(actor);
    const result = await sourcingService.decideOverride(params.taskId, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
