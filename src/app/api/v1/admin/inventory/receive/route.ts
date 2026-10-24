import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  inventoryService,
  receiveStockSchema,
  assertCanManageInventory,
} from "@/modules/inventory";

export const POST = withRoute(
  {
    auth: "staff",
    body: receiveStockSchema,
  },
  async ({ body, actor }) => {
    assertCanManageInventory(actor);
    const result = await inventoryService.receive(
      undefined,
      {
        ...body,
        staffId: actor?.id,
      },
      actor
    );
    return NextResponse.json(result, { status: 201 });
  }
);
