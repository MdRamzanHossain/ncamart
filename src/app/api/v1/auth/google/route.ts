import { NextRequest, NextResponse } from "next/server";
import { settingsService } from "@/modules/settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Fast path: Check Environment Variables first (0 ms, zero DB / Redis latency)
    let clientId =
      process.env.GOOGLE_CLIENT_ID?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
      "";
    let enabled = Boolean(clientId);
    let redirectUri = "";

    // 2. If not found in env, check Database Settings
    if (!clientId) {
      try {
        const config = await settingsService.get("GOOGLE_AUTH_CONFIG");
        clientId = config.clientId?.trim() || "";
        enabled = Boolean(config.enabled && clientId);
        redirectUri = config.redirectUri?.trim() || "";
      } catch {
        // Fallback if settings query fails
      }
    }

    // If still not configured or disabled
    if (!clientId || !enabled) {
      return NextResponse.redirect(
        new URL("/auth/login?error=google_not_configured", req.nextUrl.origin)
      );
    }

    // 3. Resolve redirect_uri
    const origin =
      req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host")}`
        : req.nextUrl.origin;

    if (!redirectUri || !redirectUri.startsWith("http")) {
      redirectUri = `${origin}/api/v1/auth/google/callback`;
    }

    // 4. Capture intended destination
    const targetRedirect = req.nextUrl.searchParams.get("redirect") || "";
    const statePayload = JSON.stringify({
      redirect: targetRedirect,
      ts: Date.now(),
    });
    const state = Buffer.from(statePayload).toString("base64url");

    // 5. Build Google OAuth 2.0 Authorization URL
    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("access_type", "online");
    googleAuthUrl.searchParams.set("prompt", "select_account");
    googleAuthUrl.searchParams.set("state", state);

    const res = NextResponse.redirect(googleAuthUrl.toString(), 302);
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  } catch (err) {
    const origin = req.nextUrl.origin;
    const msg = err instanceof Error ? encodeURIComponent(err.message) : "oauth_init_failed";
    return NextResponse.redirect(new URL(`/auth/login?error=${msg}`, origin));
  }
}
