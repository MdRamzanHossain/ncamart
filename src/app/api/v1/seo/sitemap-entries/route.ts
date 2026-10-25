import { NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/modules/analytics";
import { errorResponse } from "@/lib/http/route";

export async function GET(_req: NextRequest) {
  try {
    const sitemap = await analyticsService.getSitemapEntries();

    return NextResponse.json(sitemap, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
