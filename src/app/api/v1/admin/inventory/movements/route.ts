import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  inventoryService,
  stockMovementFilterSchema,
  assertCanReadInventory,
} from "@/modules/inventory";

export const GET = withRoute(
  {
    auth: "staff",
    query: stockMovementFilterSchema,
  },
  async ({ query, actor }) => {
    assertCanReadInventory(actor);
    const result = await inventoryService.listMovements(query, actor);
    return NextResponse.json(result, { status: 200 });
  }
);
