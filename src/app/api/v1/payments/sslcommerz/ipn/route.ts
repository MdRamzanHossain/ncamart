import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { paymentsService } from "@/modules/payments";

export const POST = withRoute(
  {
    auth: "public",
  },
  async ({ body, req }) => {
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const payload = (body ?? {}) as Record<string, string>;
    const result = await paymentsService.handleIpn(payload, clientIp);
    return NextResponse.json(result, { status: 200 });
  }
);
