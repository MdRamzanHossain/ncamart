import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  updateSupplierStockBatchSchema,
  assertCanManageSuppliers,
} from "@/modules/sourcing";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const PUT = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
    body: updateSupplierStockBatchSchema,
  },
  async ({ params, body, actor }) => {
    assertCanManageSuppliers(actor);
    const updated = await sourcingService.updateSupplierStock(
      params.id,
      body.items,
      actor
    );
    return NextResponse.json(updated, { status: 200 });
  }
);
