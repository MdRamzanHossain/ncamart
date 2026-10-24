import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService, SkuInputSchema } from "@/modules/catalog";
import { NextResponse } from "next/server";

const paramsSchema = z.object({
  id: z.string(),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
    body: SkuInputSchema,
  },
  async ({ params, body, actor }) => {
    const sku = await catalogService.createSku(
      {
        ...body,
        productId: params.id,
      },
      actor!
    );

    return NextResponse.json(sku, { status: 201 });
  }
);
