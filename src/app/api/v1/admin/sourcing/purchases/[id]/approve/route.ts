import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  assertCanApprovePurchase,
} from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
  },
  async ({ params, actor }) => {
    assertCanApprovePurchase(actor);
    const purchaseId = (params as { id: string }).id;
    const updated = await sourcingService.approvePurchase(purchaseId, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);
