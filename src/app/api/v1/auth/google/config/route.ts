import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { settingsService } from "@/modules/settings";

export const GET = withRoute(
  {
    auth: "public",
  },
  async () => {
    try {
      const config = await settingsService.get("GOOGLE_AUTH_CONFIG");
      return NextResponse.json(
        {
          enabled: Boolean(config.enabled && config.clientId),
          client_id: config.clientId || "",
          redirect_uri: config.redirectUri || "",
        },
        { status: 200 }
      );
    } catch {
      return NextResponse.json(
        {
          enabled: false,
          client_id: "",
          redirect_uri: "",
        },
        { status: 200 }
      );
    }
  }
);

