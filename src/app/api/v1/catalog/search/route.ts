import { withRoute } from "@/lib/http/route";
import { searchService, searchQueryParamsSchema } from "@/modules/search";
import { CACHE_CONTROL_CDN } from "@/modules/catalog";
import { NextResponse } from "next/server";

export const GET = withRoute(
  {
    auth: "public",
    query: searchQueryParamsSchema,
  },
  async ({ query }) => {
    const result = await searchService.search(query);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "cache-control": CACHE_CONTROL_CDN,
      },
    });
  }
);
