import { withRoute } from "@/lib/http/route";
import {
  catalogService,
  CreateProductWithSkusDtoSchema,
  ProductListFilterDtoSchema,
} from "@/modules/catalog";
import { NextResponse } from "next/server";

export const GET = withRoute(
  {
    auth: "staff",
    permission: "catalog.read",
    query: ProductListFilterDtoSchema,
  },
  async ({ query }) => {
    const result = await catalogService.listProducts(query);
    return NextResponse.json(result, { status: 200 });
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    body: CreateProductWithSkusDtoSchema,
  },
  async ({ body, actor }) => {
    const { product } = await catalogService.createDraftProductWithSkus(body, actor!);

    return NextResponse.json(
      {
        product_id: product.id,
        status: product.status,
      },
      { status: 201 }
    );
  }
);
