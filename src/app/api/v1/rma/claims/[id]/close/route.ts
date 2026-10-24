import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { rmaService } from "@/modules/rma";

export const POST = withRoute(
  {
    auth: "staff",
  },
  async ({ actor, params, body }) => {
    const identifier = params?.id as string;
    const notes = (body as any)?.notes;
    const result = await rmaService.closeClaim(actor!, identifier, notes);
    return NextResponse.json({
      claim_number: result.claimNumber,
      status: result.status,
      closed_at: result.closedAt?.toISOString(),
      message: "Claim closed; 180-day media retention initiated.",
    });
  }
);
