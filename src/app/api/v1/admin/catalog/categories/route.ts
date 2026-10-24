import { withRoute } from "@/lib/http/route";
import { catalogService, CreateCategoryDtoSchema } from "@/modules/catalog";
import { NextResponse } from "next/server";

export const GET = withRoute(
  {
    auth: "staff",
    permission: "catalog.read",
  },
  async () => {
    const list = await catalogService.listCategories();
    return NextResponse.json(list, { status: 200 });
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    body: CreateCategoryDtoSchema,
  },
  async ({ body, actor }) => {
    const category = await catalogService.createCategory(body, actor!);
    return NextResponse.json(category, { status: 201 });
  }
);
