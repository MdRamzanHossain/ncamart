import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  inventoryService,
  startCycleCountSchema,
  assertCanManageInventory,
} from "@/modules/inventory";

export const POST = withRoute(
  {
    auth: "staff",
    body: startCycleCountSchema,
  },
  async ({ body, actor }) => {
    assertCanManageInventory(actor);
    const result = await inventoryService.startCycleCount(body, actor!);
    return NextResponse.json(result, { status: 201 });
  }
);
