import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { refundsService, executeManualRefundSchema } from "@/modules/payments";

export const POST = withRoute(
  {
    auth: "staff",
    body: executeManualRefundSchema,
  },
  async ({ actor, body }) => {
    const refund = await refundsService.executeManualPayout(actor!, body);
    return NextResponse.json({ success: true, refund }, { status: 200 });
  }
);
