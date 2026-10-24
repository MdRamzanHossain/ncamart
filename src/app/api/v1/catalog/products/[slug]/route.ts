import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService, CACHE_CONTROL_CDN } from "@/modules/catalog";
import { NextResponse } from "next/server";

const paramsSchema = z.object({
  slug: z.string().min(1),
});

export const GET = withRoute(
  {
    auth: "public",
    params: paramsSchema,
  },
  async ({ params }) => {
    const detail = await catalogService.getPublicProductDetail(params.slug);

    return NextResponse.json(detail, {
      status: 200,
      headers: {
        "cache-control": CACHE_CONTROL_CDN,
      },
    });
  }
);
