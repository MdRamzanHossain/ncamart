import { withRoute } from "@/lib/http/route";
import { notificationsService } from "@/modules/notifications";

export const POST = withRoute(
  {
    auth: "staff",
  },
  async ({ actor, params }) => {
    const id = params?.id as string;
    const result = await notificationsService.retryDeadLetterNotification(id, actor!);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
