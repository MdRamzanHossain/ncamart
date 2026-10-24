import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { trustService, assertCanManageCloneAlerts } from "@/modules/trust";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor, req }) => {
    assertCanManageCloneAlerts(actor);
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const result = await trustService.listCloneAlerts({ status }, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
