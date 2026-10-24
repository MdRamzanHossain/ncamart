import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService, CreateCategorySpecFieldDtoSchema } from "@/modules/catalog";
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
    const fields = await catalogService.getCategorySpecFields(params.id);
    return NextResponse.json(fields, { status: 200 });
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
    body: CreateCategorySpecFieldDtoSchema.omit({ categoryId: true }),
  },
  async ({ params, body, actor }) => {
    const field = await catalogService.createCategorySpecField(
      {
        ...body,
        categoryId: params.id,
      },
      actor!
    );
    return NextResponse.json(field, { status: 201 });
  }
);
