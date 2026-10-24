import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { refundsService } from "@/modules/payments";

export const GET = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().min(1),
    }),
  },
  async ({ actor, params }) => {
    const refund = await refundsService.getRefundDetail(actor!, params.id);
    return NextResponse.json({ success: true, refund }, { status: 200 });
  }
);
