import { NextRequest, NextResponse } from "next/server";
import { defaultActorResolver } from "@/lib/http/route";
import "@/modules/identity";

export async function GET(req: NextRequest): Promise<Response> {
  const isProduction =
    process.env.NODE_ENV === "production" &&
    (process.env.APP_ENV === "production" || !process.env.APP_ENV);

  if (isProduction) {
    const actor = await defaultActorResolver.resolve(req);
    const isSuperAdmin =
      actor?.type === "staff" && actor.roles?.includes("SUPER_ADMIN");

    if (!isSuperAdmin) {
      return NextResponse.json(
        {
          error: {
            code: "ERR_FORBIDDEN",
            message: "API Documentation is restricted to SUPER_ADMIN in production environments",
            status: 403,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <title>NCAMart REST API Documentation</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.ico" />
    <style>
      body { margin: 0; padding: 0; background-color: #0f172a; }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/api/v1/openapi.json"
      data-configuration='{"theme":"purple","darkMode":true,"metaData":{"title":"NCAMart API Documentation"}}'
      src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": isProduction ? "private, no-cache" : "public, max-age=3600",
    },
  });
}
