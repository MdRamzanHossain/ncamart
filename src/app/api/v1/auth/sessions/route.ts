import { withRoute } from "@/lib/http/route";
import { authService } from "@/modules/identity";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    if (!actor) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    const sessions = await authService.listCustomerSessions(actor.id);
    const mapped = sessions.map((s) => ({
      id: s.id,
      device_id: s.deviceId,
      device_label: s.deviceLabel,
      ip: s.ip,
      user_agent: s.userAgent,
      is_current: s.id === actor.sessionId,
      created_at: s.createdAt,
      last_seen_at: s.lastSeenAt,
    }));

    return new Response(JSON.stringify(mapped), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }
);
