import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { sourcingService } from "@/modules/sourcing";

export const GET = withRoute(
  {
    auth: "staff",
    permission: "sourcing.quarantine.review",
  },
  async ({ actor }) => {
    const result = await sourcingService.listQuarantinedPurchases(actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
