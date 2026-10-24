import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  trustService,
  qcInspectSchema,
  assertCanExecuteQc,
} from "@/modules/trust";

export const POST = withRoute(
  {
    auth: "staff",
    body: qcInspectSchema,
  },
  async ({ body, actor }) => {
    assertCanExecuteQc(actor);
    const result = await trustService.inspect(body, actor!);
    return NextResponse.json(result, { status: 201 });
  }
);
