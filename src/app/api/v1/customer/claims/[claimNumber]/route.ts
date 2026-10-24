import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { rmaService } from "@/modules/rma";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor, params }) => {
    const claimNumber = params?.claimNumber as string;
    const claim = await rmaService.getClaimDetail(actor!, claimNumber);
    return NextResponse.json(claim);
  }
);
