import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  assertCanReadSuppliers,
} from "@/modules/sourcing";

const paramsSchema = z.object({
  skuId: z.string().uuid(),
});

export const GET = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    assertCanReadSuppliers(actor);
    const suppliers = await sourcingService.getSuppliersForSku(
      params.skuId,
      actor
    );
    return NextResponse.json(suppliers, { status: 200 });
  }
);
