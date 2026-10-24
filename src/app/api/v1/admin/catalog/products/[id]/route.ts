import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService, UpdateProductDtoSchema } from "@/modules/catalog";
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
    const full = await catalogService.getFullProduct(params.id);
    return NextResponse.json(full, { status: 200 });
  }
);

export const PUT = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
    body: UpdateProductDtoSchema,
  },
  async ({ params, body, actor }) => {
    const updated = await catalogService.updateProduct(params.id, body, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);
