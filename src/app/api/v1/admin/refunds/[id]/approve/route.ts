import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { refundsService, approveRefundSchema } from "@/modules/payments";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().min(1),
    }),
    body: approveRefundSchema.optional(),
  },
  async ({ actor, params, body }) => {
    const refund = await refundsService.approveRefund(actor!, params.id, body);
    return NextResponse.json({ success: true, refund }, { status: 200 });
  }
);
