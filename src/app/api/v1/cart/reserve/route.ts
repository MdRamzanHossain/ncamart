import crypto from "node:crypto";
import { withRoute } from "@/lib/http/route";
import { reserveCart, CartReserveInputSchema } from "@/modules/orders";

export const POST = withRoute(
  {
    auth: "public",
    body: CartReserveInputSchema,
  },
  async ({ req, body, actor }) => {
    let deviceId =
      req.cookies.get("nca_did")?.value ||
      req.headers.get("x-device-id") ||
      (actor && actor.type === "customer" ? `customer-${actor.id}` : null);

    let shouldSetCookie = false;
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      shouldSetCookie = true;
    }

    const result = await reserveCart(undefined, body, deviceId, actor ?? undefined);

    const response = new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    if (shouldSetCookie) {
      const isProd = process.env.NODE_ENV === "production";
      const maxAgeSeconds = 365 * 24 * 60 * 60; // 1 year device cookie
      response.headers.set(
        "set-cookie",
        `nca_did=${deviceId}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${
          isProd ? "; Secure" : ""
        }`
      );
    }

    return response;
  }
);
