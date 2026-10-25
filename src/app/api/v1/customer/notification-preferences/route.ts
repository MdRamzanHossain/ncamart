import { withRoute } from "@/lib/http/route";
import { notificationsService } from "@/modules/notifications";
import { UpdateCustomerPreferencesInputSchema } from "@/modules/notifications/dto";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    const prefs = await notificationsService.updatePreferences(actor!.id, {}, actor!);
    return new Response(JSON.stringify(prefs), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);

export const PUT = withRoute(
  {
    auth: "customer",
    body: UpdateCustomerPreferencesInputSchema,
  },
  async ({ actor, body }) => {
    const updated = await notificationsService.updatePreferences(actor!.id, body, actor!);
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
