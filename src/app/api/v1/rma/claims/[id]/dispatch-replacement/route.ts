import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { rmaService } from "@/modules/rma";

export const POST = withRoute(
  {
    auth: "staff",
  },
  async ({ actor, params }) => {
    const identifier = params?.id as string;
    const result = await rmaService.dispatchReplacementOrder(actor!, identifier);
    return NextResponse.json({
      claim_number: result.claim.claimNumber,
      replacement_order_id: result.replacementOrder.id,
      order_number: result.replacementOrder.orderNumber,
      status: result.claim.status,
    });
  }
);
