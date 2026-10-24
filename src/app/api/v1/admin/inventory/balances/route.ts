import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  inventoryService,
  inventoryBalanceFilterSchema,
  assertCanReadInventory,
} from "@/modules/inventory";

export const GET = withRoute(
  {
    auth: "staff",
    query: inventoryBalanceFilterSchema,
  },
  async ({ query, actor }) => {
    assertCanReadInventory(actor);
    const result = await inventoryService.listBalances(query, actor);
    return NextResponse.json(result, { status: 200 });
  }
);
