import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  runnerTaskFilterSchema,
  assertCanManageSourcingTasks,
} from "@/modules/sourcing";

export const GET = withRoute(
  {
    auth: "staff",
    query: runnerTaskFilterSchema,
  },
  async ({ query, actor }) => {
    assertCanManageSourcingTasks(actor);
    const result = await sourcingService.listAdminTasks(query, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
