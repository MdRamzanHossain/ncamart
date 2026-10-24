import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  runnerTaskOverrideRequestSchema,
  assertCanAccessRunnerTasks,
} from "@/modules/sourcing";

const paramsSchema = z.object({
  taskId: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
    body: runnerTaskOverrideRequestSchema,
  },
  async ({ params, body, actor }) => {
    assertCanAccessRunnerTasks(actor);
    const result = await sourcingService.requestOverride(params.taskId, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
