import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService, CreateCategoryDtoSchema } from "@/modules/catalog";
import { NextResponse } from "next/server";

const paramsSchema = z.object({
  id: z.string(),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "catalog.read",
    params: paramsSchema,
  },
  async ({ params }) => {
    const category = await catalogService.getCategoryById(params.id);
    return NextResponse.json(category, { status: 200 });
  }
);

export const PUT = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
    body: CreateCategoryDtoSchema.partial(),
  },
  async ({ params, body, actor }) => {
    const updated = await catalogService.updateCategory(params.id, body, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);

export const DELETE = withRoute(
  {
    auth: "staff",
    permission: "catalog.publish", // SUPER_ADMIN only
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    await catalogService.deleteCategory(params.id, actor!);
    return NextResponse.json({ success: true }, { status: 200 });
  }
);
