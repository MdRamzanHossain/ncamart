import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  inventoryService,
  adjudicateAdjustmentSchema,
  assertCanApproveAdjustment,
} from "@/modules/inventory";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
    body: adjudicateAdjustmentSchema,
  },
  async ({ params, body, actor }) => {
    assertCanApproveAdjustment(actor);
    const result = await inventoryService.rejectAdjustment(
      params.id,
      body,
      actor!
    );
    return NextResponse.json(result, { status: 200 });
  }
);
