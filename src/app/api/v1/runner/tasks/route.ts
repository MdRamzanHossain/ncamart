import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  runnerTaskFilterSchema,
  assertCanAccessRunnerTasks,
} from "@/modules/sourcing";

export const GET = withRoute(
  {
    auth: "staff",
    query: runnerTaskFilterSchema,
  },
  async ({ query, actor }) => {
    assertCanAccessRunnerTasks(actor);
    const result = await sourcingService.listRunnerTasks(query, actor);
    return NextResponse.json(result, { status: 200 });
  }
);
