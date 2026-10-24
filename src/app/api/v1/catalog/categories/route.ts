import { withRoute } from "@/lib/http/route";
import { catalogService, CACHE_CONTROL_CDN } from "@/modules/catalog";
import { NextResponse } from "next/server";

export const GET = withRoute(
  {
    auth: "public",
  },
  async () => {
    const tree = await catalogService.getPublicCategoryTree();

    return NextResponse.json(
      { categories: tree },
      {
        status: 200,
        headers: {
          "cache-control": CACHE_CONTROL_CDN,
        },
      }
    );
  }
);
