import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { rmaService, adjudicateClaimSchema } from "@/modules/rma";

export const POST = withRoute(
  {
    auth: "staff",
    schema: adjudicateClaimSchema,
  },
  async ({ actor, params, body }) => {
    const identifier = params?.id as string;
    const result = await rmaService.adjudicateClaim(actor!, identifier, body);
    return NextResponse.json({
      claim_number: result.claimNumber,
      status: result.status,
      decision: result.decision,
      rejection_reason: result.rejectionReason,
      reverse_shipment_id: result.reverseShipmentId,
    });
  }
);
