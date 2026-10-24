import { withRoute } from "@/lib/http/route";
import { authService, SESSION_COOKIE_NAME } from "@/modules/identity";

export const POST = withRoute(
  {
    auth: "any",
  },
  async ({ actor }) => {
    if (actor?.sessionId) {
      await authService.revokeSession(actor.sessionId, actor.id);
    }

    const response = new Response(JSON.stringify({ success: true, message: "Logged out successfully" }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

    // Clear session cookie
    const isProd = process.env.NODE_ENV === "production";
    response.headers.set(
      "set-cookie",
      `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`
    );

    return response;
  }
);
