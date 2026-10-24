import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  trustService,
  supervisorAuditSchema,
  assertCanAuditSampling,
} from "@/modules/trust";

export const POST = withRoute(
  {
    auth: "staff",
    body: supervisorAuditSchema,
  },
  async ({ params, body, actor }) => {
    assertCanAuditSampling(actor);
    const { id } = await params;
    const result = await trustService.supervisorAudit(id, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
