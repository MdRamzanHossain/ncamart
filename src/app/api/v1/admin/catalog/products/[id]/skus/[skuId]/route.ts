import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService, UpdateSkuDtoSchema } from "@/modules/catalog";
import { NextResponse } from "next/server";

const paramsSchema = z.object({
  id: z.string(),
  skuId: z.string(),
});

export const PUT = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
    body: UpdateSkuDtoSchema,
  },
  async ({ params, body, actor }) => {
    const updated = await catalogService.updateSku(params.id, params.skuId, body, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);
