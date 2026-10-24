import { withRoute } from "@/lib/http/route";
import {
  catalogService,
  PublicProductFilterDtoSchema,
  CACHE_CONTROL_CDN,
} from "@/modules/catalog";
import { NextResponse } from "next/server";

export const GET = withRoute(
  {
    auth: "public",
    query: PublicProductFilterDtoSchema,
  },
  async ({ query }) => {
    const result = await catalogService.getPublicProducts(query);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "cache-control": CACHE_CONTROL_CDN,
      },
    });
  }
);
