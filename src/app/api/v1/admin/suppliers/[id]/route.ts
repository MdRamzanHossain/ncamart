import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  updateSupplierSchema,
  assertCanReadSuppliers,
  assertCanManageSuppliers,
} from "@/modules/sourcing";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const GET = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    assertCanReadSuppliers(actor);
    const supplier = await sourcingService.getSupplierById(params.id, actor);
    return NextResponse.json(supplier, { status: 200 });
  }
);

export const PUT = withRoute(
  {
    auth: "staff",
    params: paramsSchema,
    body: updateSupplierSchema,
  },
  async ({ params, body, actor }) => {
    assertCanManageSuppliers(actor);
    const updated = await sourcingService.updateSupplier(params.id, body, actor);
    return NextResponse.json(updated, { status: 200 });
  }
);
