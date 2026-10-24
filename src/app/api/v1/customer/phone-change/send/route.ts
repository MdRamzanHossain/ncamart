import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { authService } from "@/modules/identity";
import { UnauthenticatedError } from "@/lib/errors";

const bodySchema = z.object({
  new_phone: z.string().min(10).max(16),
});

export const POST = withRoute(
  {
    auth: "customer",
    body: bodySchema,
  },
  async ({ req, actor, body }) => {
    if (!actor) {
      throw new UnauthenticatedError("Customer authentication required");
    }

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for") ||
      "127.0.0.1";

    const result = await authService.sendPhoneChangeOtp(actor.id, body.new_phone, clientIp);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }
);
