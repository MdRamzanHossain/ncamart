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
    const result = await rmaService.receiveClaimUnit(actor!, identifier, notes);
    return NextResponse.json({
      claim_number: result.claimNumber,
      status: result.status,
      message: "Unit received at godown into RMA_HOLD",
    });
  }
);
