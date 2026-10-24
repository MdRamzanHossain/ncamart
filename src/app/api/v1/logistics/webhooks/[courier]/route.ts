import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService, getCourierAdapter } from "@/modules/logistics";
import { logger } from "@/lib/logger";

export const POST = withRoute(
  {
    auth: "public",
  },
  async ({ req, body, params }) => {
    const { courier } = (await params) as { courier: string };
    const adapter = getCourierAdapter(courier);

    const forwardReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: typeof body === "object" ? JSON.stringify(body) : String(body ?? ""),
    });

    // 1. Adapter verifies courier auth and returns normalized events
    const events = await adapter.parseWebhook(forwardReq);

    // 2. Ingest and apply normalized events
    const results = [];
    for (const event of events) {
      const res = await logisticsService.applyCourierEvent(event, courier);
      results.push(res);
    }

    return NextResponse.json(
      {
        success: true,
        courier,
        events_processed: events.length,
        results,
      },
      { status: 200 }
    );
  }
);
