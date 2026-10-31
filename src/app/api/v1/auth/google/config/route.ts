import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { settingsService } from "@/modules/settings";

export const dynamic = "force-dynamic";

export const GET = withRoute(
  {
    auth: "public",
  },
  async () => {
    let clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
      process.env.GOOGLE_CLIENT_ID?.trim() ||
      "";
    let enabled = Boolean(clientId);
    let redirectUri = "";

    // If not found in environment, query settings
    if (!clientId) {
      try {
        const config = await settingsService.get("GOOGLE_AUTH_CONFIG");
        clientId = config.clientId?.trim() || "";
        enabled = Boolean(config.enabled && clientId);
        redirectUri = config.redirectUri?.trim() || "";
      } catch {
        // DB settings fallback
      }
    }

    const response = NextResponse.json(
      {
        enabled,
        client_id: clientId,
        redirect_uri: redirectUri,
      },
      { status: 200 }
    );

    // Cache config for 5 minutes so subsequent frontend visits are instant
    response.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return response;
  }
);
