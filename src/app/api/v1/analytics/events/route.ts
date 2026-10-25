import { NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/modules/analytics";
import { errorResponse } from "@/lib/http/route";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;
    const url = req.headers.get("referer") || undefined;

    const result = await analyticsService.trackClientEvent(body, {
      ip,
      userAgent,
      url,
    });

    if (!result.accepted) {
      return NextResponse.json(
        {
          error: "REJECTED_EVENT",
          message: result.reason || "Event could not be accepted",
          event_name: result.eventName,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      accepted: true,
      event_name: result.eventName,
      consent_status: result.consentStatus,
      forwarded_to: result.forwardedTo,
      record_id: result.recordId,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
