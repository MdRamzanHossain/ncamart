import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  trustService,
  approveVoidRequestSchema,
  assertCanApproveSealVoid,
} from "@/modules/trust";

export const POST = withRoute(
  {
    auth: "staff",
    body: approveVoidRequestSchema.optional(),
  },
  async ({ params, body, actor }) => {
    assertCanApproveSealVoid(actor);
    const { id } = await params;
    const result = await trustService.approveVoidRequest(id, actor!, body);
    return NextResponse.json(result, { status: 200 });
  }
);
