import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { staffAuthService, STAFF_SESSION_COOKIE_NAME } from "@/modules/identity";

const confirmSchema = z.object({
  enrollment_token: z.string().min(1),
  totp_code: z.string().min(6).max(8),
});

export const POST = withRoute(
  {
    auth: "public",
    body: confirmSchema,
  },
  async ({ body }) => {
    const result = await staffAuthService.confirmTotp(
      body.enrollment_token,
      body.totp_code
    );

    const response = new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const isProd = process.env.NODE_ENV === "production";
    const twelveHoursSeconds = 12 * 60 * 60;
    const cookieHeader = `${STAFF_SESSION_COOKIE_NAME}=${result.session_token}; Path=/; Max-Age=${twelveHoursSeconds}; HttpOnly; SameSite=Lax${
      isProd ? "; Secure" : ""
    }`;

    response.headers.set("set-cookie", cookieHeader);
    return response;
  }
);
