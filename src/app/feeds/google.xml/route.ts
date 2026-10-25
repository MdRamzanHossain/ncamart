import { NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/modules/analytics";

export async function GET(_req: NextRequest) {
  try {
    const xml = await analyticsService.getGoogleMerchantXml();

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    return new NextResponse(`<?xml version="1.0"?><error>${String(err)}</error>`, {
      status: 500,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }
}
