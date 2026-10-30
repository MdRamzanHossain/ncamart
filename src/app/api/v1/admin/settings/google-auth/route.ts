import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { settingsService } from "@/modules/settings";

export const dynamic = "force-dynamic";

const updateGoogleAuthSchema = z.object({
  enabled: z.boolean(),
  client_id: z.string().trim().default(""),
  client_secret: z.string().trim().optional(),
  redirect_uri: z.string().trim().optional(),
});

export const GET = withRoute(
  {
    auth: "staff",
  },
  async () => {
    let config = {
      enabled: false,
      clientId: "",
      clientSecret: "",
      redirectUri: "",
    };

    try {
      config = await settingsService.get("GOOGLE_AUTH_CONFIG");
    } catch {
      // fallback
    }

    let clientId = config.clientId || "";
    let secret = config.clientSecret || "";
    const enabled = config.enabled;
    const redirectUri = config.redirectUri || "";

    if (!clientId) {
      clientId =
        process.env.GOOGLE_CLIENT_ID?.trim() ||
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
        "";
    }
    if (!secret) {
      secret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
    }
    if (clientId && secret && !enabled) {
      // auto-reflect if env configured
    }

    const maskedSecret = secret
      ? secret.length > 8
        ? `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`
        : "••••••••"
      : "";

    const response = NextResponse.json(
      {
        enabled,
        client_id: clientId,
        client_secret_masked: maskedSecret,
        has_secret: Boolean(secret),
        redirect_uri: redirectUri || "https://ncamart.com/api/v1/auth/google/callback",
      },
      { status: 200 }
    );

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return response;
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    body: updateGoogleAuthSchema,
  },
  async ({ actor, body }) => {
    let existing = {
      enabled: false,
      clientId: "",
      clientSecret: "",
      redirectUri: "",
    };

    try {
      existing = await settingsService.get("GOOGLE_AUTH_CONFIG");
    } catch {
      // fallback
    }

    // Preserve existing secret if placeholder/masked or blank was sent
    let newSecret = existing.clientSecret || "";
    if (body.client_secret && !body.client_secret.includes("••••")) {
      newSecret = body.client_secret;
    }

    const updatedConfig = {
      enabled: body.enabled,
      clientId: body.client_id,
      clientSecret: newSecret,
      redirectUri: body.redirect_uri || existing.redirectUri || "https://ncamart.com/api/v1/auth/google/callback",
    };

    await settingsService.set("GOOGLE_AUTH_CONFIG", updatedConfig, actor?.id || "staff");

    return NextResponse.json(
      {
        success: true,
        message: "Google OAuth sign-in configuration updated successfully.",
        config: {
          enabled: updatedConfig.enabled,
          client_id: updatedConfig.clientId,
          has_secret: Boolean(updatedConfig.clientSecret),
          redirect_uri: updatedConfig.redirectUri,
        },
      },
      { status: 200 }
    );
  }
);
