import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  trustService,
  voidSealSchema,
  assertCanExecuteQc,
} from "@/modules/trust";

export const POST = withRoute(
  {
    auth: "staff",
    body: voidSealSchema,
  },
  async ({ body, actor }) => {
    assertCanExecuteQc(actor);
    const result = await trustService.requestVoid(body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
