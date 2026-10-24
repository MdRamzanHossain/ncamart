import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  createSupplierSchema,
  supplierFilterSchema,
  assertCanReadSuppliers,
  assertCanManageSuppliers,
} from "@/modules/sourcing";

export const GET = withRoute(
  {
    auth: "staff",
    query: supplierFilterSchema,
  },
  async ({ query, actor }) => {
    assertCanReadSuppliers(actor);
    const result = await sourcingService.listSuppliers(query, actor);
    return NextResponse.json(result, { status: 200 });
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    body: createSupplierSchema,
  },
  async ({ body, actor }) => {
    assertCanManageSuppliers(actor);
    const supplier = await sourcingService.createSupplier(body, actor);
    return NextResponse.json(supplier, { status: 201 });
  }
);
