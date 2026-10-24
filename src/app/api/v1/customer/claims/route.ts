import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { rmaService } from "@/modules/rma";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    const claims = await rmaService.listCustomerClaims(actor!);
    return NextResponse.json({
      claims,
      count: claims.length,
    });
  }
);
