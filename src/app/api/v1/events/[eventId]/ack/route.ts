import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { acknowledgeStaffEvent } from "@/modules/realtime";

export const dynamic = "force-dynamic";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      eventId: z.string().min(1),
    }),
  },
  async ({ actor, params }) => {
    const ack = await acknowledgeStaffEvent(params.eventId, actor!.id);
    return NextResponse.json({
      success: true,
      event_id: ack.eventId,
      acknowledged_by: ack.staffId,
      acknowledged_at: ack.acknowledgedAt,
    });
  }
);
