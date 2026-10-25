import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { notificationsService } from "@/modules/notifications";

const optOutQuerySchema = z.object({
  token: z.string().min(1),
});

export const GET = withRoute(
  {
    auth: "optional",
    query: optOutQuerySchema,
  },
  async ({ query }) => {
    const result = await notificationsService.processOptOutToken(query.token);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
