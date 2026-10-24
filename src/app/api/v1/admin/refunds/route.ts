import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  refundsService,
  requestRefundSchema,
  listRefundsQuerySchema,
} from "@/modules/payments";

export const POST = withRoute(
  {
    auth: "staff",
    body: requestRefundSchema,
  },
  async ({ actor, body }) => {
    const refund = await refundsService.requestRefund(actor!, body);
    return NextResponse.json({ success: true, refund }, { status: 201 });
  }
);

export const GET = withRoute(
  {
    auth: "staff",
    query: listRefundsQuerySchema,
  },
  async ({ actor, query }) => {
    const result = await refundsService.listRefunds(actor!, query);
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  }
);
