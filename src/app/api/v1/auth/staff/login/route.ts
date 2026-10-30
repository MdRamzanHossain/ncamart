import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { staffAuthService, STAFF_SESSION_COOKIE_NAME } from "@/modules/identity";

const loginSchema = z
  .object({
    identifier: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1),
    totp_code: z.string().optional(),
    allow_unenrolled_totp: z.boolean().optional(),
  })
  .refine((data) => data.identifier || data.phone || data.email, {
    message: "Must provide identifier, email, or phone",
  });

export const POST = withRoute(
  {
    auth: "public",
    body: loginSchema,
  },
  async ({ req, body }) => {
    const identifier = (body.identifier || body.email || body.phone)!.trim();
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await staffAuthService.login(
      identifier,
      body.password,
      body.totp_code,
      clientIp,
      userAgent,
      { allowUnenrolledTotp: body.allow_unenrolled_totp }
    );

    // 1. Enrollment required: return 200 with enrollment_token and nothing else
    if ("totp_enrollment_required" in result) {
      return new Response(
        JSON.stringify({
          totp_enrollment_required: true,
          enrollment_token: result.enrollment_token,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // 2. Verified login: set 12-hour absolute session cookie
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
