import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  inventoryService,
  submitCycleCountLinesSchema,
  assertCanManageInventory,
} from "@/modules/inventory";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
    body: submitCycleCountLinesSchema,
  },
  async ({ params, body, actor }) => {
    assertCanManageInventory(actor);
    const result = await inventoryService.submitCycleCountLines(
      params.id,
      body,
      actor!
    );
    return NextResponse.json(result, { status: 201 });
  }
);
