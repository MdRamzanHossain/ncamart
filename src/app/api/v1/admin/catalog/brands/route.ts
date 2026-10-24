import { withRoute } from "@/lib/http/route";
import { catalogService, CreateBrandDtoSchema } from "@/modules/catalog";
import { NextResponse } from "next/server";

export const GET = withRoute(
  {
    auth: "staff",
    permission: "catalog.read",
  },
  async () => {
    const list = await catalogService.listBrands();
    return NextResponse.json(list, { status: 200 });
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    body: CreateBrandDtoSchema,
  },
  async ({ body, actor }) => {
    const brand = await catalogService.createBrand(body, actor!);
    return NextResponse.json(brand, { status: 201 });
  }
);
