import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService, CACHE_CONTROL_CDN } from "@/modules/catalog";
import { NextResponse } from "next/server";

const paramsSchema = z.object({
  comparisonGroupId: z.string().min(1),
});

export const GET = withRoute(
  {
    auth: "public",
    params: paramsSchema,
  },
  async ({ params }) => {
    const comparison = await catalogService.getPublicComparisonView(params.comparisonGroupId);

    return NextResponse.json(comparison, {
      status: 200,
      headers: {
        "cache-control": CACHE_CONTROL_CDN,
      },
    });
  }
);
