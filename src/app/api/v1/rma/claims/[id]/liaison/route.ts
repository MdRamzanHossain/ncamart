import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { rmaService, liaisonClaimSchema } from "@/modules/rma";

export const POST = withRoute(
  {
    auth: "staff",
    schema: liaisonClaimSchema,
  },
  async ({ actor, params, body }) => {
    const identifier = params?.id as string;
    const result = await rmaService.dispatchDistributorLiaison(
      actor!,
      identifier,
      body
    );
    return NextResponse.json({
      claim_number: result.claim.claimNumber,
      status: result.claim.status,
      distributor_name: result.claim.distributorName,
      liaison_task_id: result.claim.liaisonTaskId,
    });
  }
);
