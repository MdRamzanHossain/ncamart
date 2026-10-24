import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { rmaService, liaisonReturnedSchema } from "@/modules/rma";

export const POST = withRoute(
  {
    auth: "staff",
    schema: liaisonReturnedSchema,
  },
  async ({ actor, params, body }) => {
    const identifier = params?.id as string;
    const result = await rmaService.returnFromDistributorLiaison(
      actor!,
      identifier,
      body
    );
    return NextResponse.json({
      claim_number: result.claimNumber,
      status: result.status,
      distributor_outcome: result.distributorOutcome,
      resolution: result.resolution,
    });
  }
);
