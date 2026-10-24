import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  trustService,
  assertCanManageCloneAlerts,
  resolveCloneAlertSchema,
} from "@/modules/trust";

export const POST = withRoute(
  {
    auth: "staff",
    schema: resolveCloneAlertSchema,
  },
  async ({ actor, body, params }) => {
    assertCanManageCloneAlerts(actor);
    const { id } = await params;
    const alert = await trustService.resolveCloneAlert(id, body, actor!);
    return NextResponse.json({ alert }, { status: 200 });
  }
);
