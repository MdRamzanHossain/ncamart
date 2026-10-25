import { NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/modules/analytics";

export async function GET(_req: NextRequest) {
  try {
    const csv = await analyticsService.getMetaCatalogCsv();

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    return new NextResponse(`error,${String(err)}`, {
      status: 500,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  }
}
