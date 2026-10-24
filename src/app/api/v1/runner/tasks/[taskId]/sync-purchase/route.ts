import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  singleTaskSyncPurchaseSchema,
  assertCanRunRunner,
} from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: singleTaskSyncPurchaseSchema,
  },
  async ({ body, params, req, actor }) => {
    assertCanRunRunner(actor);
    const taskId = (params as { taskId: string }).taskId;
    const clientMutationId =
      req.headers.get("x-client-mutation-id") ||
      req.headers.get("client-mutation-id") ||
      crypto.randomUUID();

    const result = await sourcingService.syncSinglePurchase(
      taskId,
      body,
      clientMutationId,
      actor!
    );

    return NextResponse.json(result, { status: 200 });
  }
);
