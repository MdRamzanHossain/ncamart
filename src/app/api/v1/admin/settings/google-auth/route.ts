import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { settingsService } from "@/modules/settings";

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
    const config = await settingsService.get("GOOGLE_AUTH_CONFIG");
    const secret = config.clientSecret || "";
    const maskedSecret = secret
      ? secret.length > 8
        ? `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`
        : "••••••••"
      : "";

    return NextResponse.json(
      {
        enabled: config.enabled,
        client_id: config.clientId || "",
        client_secret_masked: maskedSecret,
        has_secret: Boolean(secret),
        redirect_uri: config.redirectUri || "",
      },
      { status: 200 }
    );
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    body: updateGoogleAuthSchema,
  },
  async ({ actor, body }) => {
    const existing = await settingsService.get("GOOGLE_AUTH_CONFIG");

    // Preserve existing secret if placeholder/masked or blank was sent
    let newSecret = existing.clientSecret || "";
    if (body.client_secret && !body.client_secret.includes("••••")) {
      newSecret = body.client_secret;
    }

    const updatedConfig = {
      enabled: body.enabled,
      clientId: body.client_id,
      clientSecret: newSecret,
      redirectUri: body.redirect_uri || existing.redirectUri || "",
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

