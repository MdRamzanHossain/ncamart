import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { settingsService } from "@/modules/settings";

export const dynamic = "force-dynamic";

export const GET = withRoute(
  {
    auth: "public",
  },
  async () => {
    let enabled = false;
    let clientId = "";
    let redirectUri = "";

    try {
      const config = await settingsService.get("GOOGLE_AUTH_CONFIG");
      clientId = config.clientId?.trim() || "";
      enabled = Boolean(config.enabled && clientId);
      redirectUri = config.redirectUri?.trim() || "";
    } catch {
      // DB settings fallback
    }

    if (!clientId) {
      clientId =
        process.env.GOOGLE_CLIENT_ID?.trim() ||
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
        "";
      if (clientId) {
        enabled = true;
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

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return response;
  }
);
