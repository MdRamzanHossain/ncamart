import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  inventoryService,
  transferStockSchema,
  assertCanManageInventory,
} from "@/modules/inventory";

export const POST = withRoute(
  {
    auth: "staff",
    body: transferStockSchema,
  },
  async ({ body, actor }) => {
    assertCanManageInventory(actor);
    const result = await inventoryService.transfer(
      undefined,
      {
        ...body,
        staffId: actor?.id,
      },
      actor
    );
    return NextResponse.json(result, { status: 200 });
  }
);
