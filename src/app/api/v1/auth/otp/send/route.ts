import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { authService } from "@/modules/identity";

const bodySchema = z.object({
  phone: z.string().min(10).max(16),
  captcha_token: z.string().optional(),
});

export const POST = withRoute(
  {
    auth: "public",
    body: bodySchema,
  },
  async ({ req, body }) => {
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for") ||
      "127.0.0.1";

    const result = await authService.sendOtp(body.phone, clientIp, body.captcha_token);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }
);
