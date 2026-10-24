import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  inventoryService,
  createAdjustmentRequestSchema,
  locationCodeEnum,
  stockAdjustmentStatusEnum,
  assertCanReadInventory,
  assertCanRequestAdjustment,
} from "@/modules/inventory";

const filterQuerySchema = z.object({
  status: z.enum(stockAdjustmentStatusEnum).optional(),
  skuId: z.string().uuid().optional(),
  locationCode: z.enum(locationCodeEnum).optional(),
});

export const GET = withRoute(
  {
    auth: "staff",
    query: filterQuerySchema,
  },
  async ({ query, actor }) => {
    assertCanReadInventory(actor);
    const result = await inventoryService.listAdjustmentRequests(
      query,
      actor!
    );
    return NextResponse.json(result, { status: 200 });
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    body: createAdjustmentRequestSchema,
  },
  async ({ body, actor }) => {
    assertCanRequestAdjustment(actor);
    const result = await inventoryService.requestAdjustment(
      body,
      actor!
    );
    return NextResponse.json(result, { status: 201 });
  }
);
