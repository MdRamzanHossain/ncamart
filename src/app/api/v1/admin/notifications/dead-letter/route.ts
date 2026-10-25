import { withRoute } from "@/lib/http/route";
import { notificationsService } from "@/modules/notifications";
import { DeadLetterQuerySchema } from "@/modules/notifications/dto";

export const GET = withRoute(
  {
    auth: "staff",
    query: DeadLetterQuerySchema,
  },
  async ({ actor, query }) => {
    const result = await notificationsService.listDeadLetter(query, actor!);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
