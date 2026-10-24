import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { rmaService, inspectClaimSchema } from "@/modules/rma";

export const POST = withRoute(
  {
    auth: "staff",
    schema: inspectClaimSchema,
  },
  async ({ actor, params, body }) => {
    const identifier = params?.id as string;
    const result = await rmaService.inspectClaim(actor!, identifier, body);
    return NextResponse.json({
      claim_number: result.claimNumber,
      status: result.status,
      resolution: result.resolution,
      rejection_reason: result.rejectionReason,
      verified_defect: result.verifiedDefect,
      seal_intact: result.sealIntact,
      replacement_order_id: result.replacementOrderId,
    });
  }
);
