import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { rmaService } from "@/modules/rma";

export const GET = withRoute(
  {
    auth: "any",
  },
  async ({ actor, params }) => {
    const identifier = params?.id as string;
    const claim = await rmaService.getClaimDetail(actor!, identifier);
    return NextResponse.json(claim);
  }
);
