import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { paymentsService } from "@/modules/payments";

export const POST = withRoute(
  {
    auth: "public",
  },
  async ({ body, req }) => {
    const payload = (body ?? {}) as Record<string, string>;
    const { orderNumber, locale } = await paymentsService.handleBrowserFail(payload);

    const redirectUrl = new URL(`/${locale}/account/orders/${orderNumber}?status=failed`, req.url);
    return NextResponse.redirect(redirectUrl, 303);
  }
);
