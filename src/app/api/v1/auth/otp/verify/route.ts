import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { authService, SESSION_COOKIE_NAME } from "@/modules/identity";

const bodySchema = z.object({
  phone: z.string().min(10).max(16),
  otp_code: z.string().length(6),
  device_id: z.string().optional(),
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
    const userAgent = req.headers.get("user-agent") || undefined;
    const deviceId = body.device_id || req.cookies.get("nca_did")?.value;

    const result = await authService.verifyOtp(body.phone, body.otp_code, {
      deviceId,
      clientIp,
      userAgent,
    });

    const response = new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

    // Set 30-day sliding session cookie
    const isProd = process.env.NODE_ENV === "production";
    const maxAgeSeconds = 30 * 24 * 60 * 60;
    const cookieHeader = `${SESSION_COOKIE_NAME}=${result.session_token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${
      isProd ? "; Secure" : ""
    }`;

    response.headers.set("set-cookie", cookieHeader);
    return response;
  }
);
