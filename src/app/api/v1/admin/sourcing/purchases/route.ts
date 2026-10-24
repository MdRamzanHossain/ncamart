import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  assertCanReadSuppliers,
} from "@/modules/sourcing";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ req, actor }) => {
    assertCanReadSuppliers(actor);
    const searchParams = req.nextUrl.searchParams;
    const runnerId = searchParams.get("runnerId") || searchParams.get("runner_id") || undefined;
    const supplierId = searchParams.get("supplierId") || searchParams.get("supplier_id") || undefined;
    const taskId = searchParams.get("taskId") || searchParams.get("task_id") || undefined;
    const syncStatus = (searchParams.get("syncStatus") || searchParams.get("sync_status") || undefined) as any;
    const reqApproval = searchParams.get("requiresApproval") || searchParams.get("requires_approval");
    const requiresApproval = reqApproval !== null ? reqApproval === "true" : undefined;

    const result = await sourcingService.listPurchases(
      {
        runnerId,
        supplierId,
        taskId,
        syncStatus,
        requiresApproval,
      },
      actor!
    );

    return NextResponse.json(result, { status: 200 });
  }
);
