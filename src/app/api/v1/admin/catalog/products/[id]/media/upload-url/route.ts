import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService, ProductImageUploadUrlDtoSchema } from "@/modules/catalog";
import { NextResponse } from "next/server";

const paramsSchema = z.object({
  id: z.string(),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
    body: ProductImageUploadUrlDtoSchema,
  },
  async ({ params, body, actor }) => {
    const result = await catalogService.createImageUploadUrl(params.id, body, actor!);
    return NextResponse.json(result, { status: 201 });
  }
);
