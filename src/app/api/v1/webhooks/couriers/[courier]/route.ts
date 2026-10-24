import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { logisticsService, getCourierAdapter } from "@/modules/logistics";

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

    const events = await adapter.parseWebhook(forwardReq);

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
