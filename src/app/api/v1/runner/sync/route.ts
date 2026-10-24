import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  runnerSyncBatchSchema,
  assertCanRunRunner,
} from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: runnerSyncBatchSchema,
  },
  async ({ body, req, actor }) => {
    assertCanRunRunner(actor);
    const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key") || undefined;
    const response = await sourcingService.syncMutations(body, actor!, idempotencyKey);
    return NextResponse.json(response, { status: 200 });
  }
);
