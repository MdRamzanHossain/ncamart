import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { sourcingService, assertCanAccessRunnerTasks } from "@/modules/sourcing";

const paramsSchema = z.object({
  taskId: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    assertCanAccessRunnerTasks(actor);
    const updated = await sourcingService.markTaskContacted(params.taskId, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);
