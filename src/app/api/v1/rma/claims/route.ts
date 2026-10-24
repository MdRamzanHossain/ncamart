import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  rmaService,
  submitClaimSchema,
  listClaimsQuerySchema,
} from "@/modules/rma";

export const POST = withRoute(
  {
    auth: "any",
    schema: submitClaimSchema,
  },
  async ({ actor, body }) => {
    const result = await rmaService.submitClaim(actor!, body);
    return NextResponse.json(result, { status: 201 });
  }
);

export const GET = withRoute(
  {
    auth: "staff",
    querySchema: listClaimsQuerySchema,
  },
  async ({ actor, query }) => {
    const claims = await rmaService.listStaffClaims(actor!, query);
    return NextResponse.json({
      claims,
      count: claims.length,
    });
  }
);
