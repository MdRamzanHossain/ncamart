import { withRoute } from "@/lib/http/route";
import { notificationsService } from "@/modules/notifications";
import { DeliveryReceiptWebhookInputSchema } from "@/modules/notifications/dto";

export const POST = withRoute(
  {
    auth: "optional",
    body: DeliveryReceiptWebhookInputSchema,
  },
  async ({ params, body }) => {
    const provider = params?.provider as string;
    const result = await notificationsService.handleDeliveryReceipt(provider, body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
