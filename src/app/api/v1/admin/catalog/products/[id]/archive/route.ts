import { withRoute } from "@/lib/http/route";
import { catalogService } from "@/modules/catalog";
import { NextResponse } from "next/server";
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string(),
});

const ArchiveBodySchema = z.object({
  notes: z.string().optional(),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
    body: ArchiveBodySchema,
  },
  async ({ params, body, actor }) => {
    const product = await catalogService.archiveProduct(params.id, actor!, body?.notes);
    return NextResponse.json(product, { status: 200 });
  }
);
