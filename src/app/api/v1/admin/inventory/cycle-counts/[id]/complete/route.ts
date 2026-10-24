import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  inventoryService,
  assertCanManageInventory,
} from "@/modules/inventory";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    assertCanManageInventory(actor);
    const result = await inventoryService.completeCycleCount(
      params.id,
      actor!
    );
    return NextResponse.json(result, { status: 200 });
  }
);
