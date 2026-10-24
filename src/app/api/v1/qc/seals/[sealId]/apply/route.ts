import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  trustService,
  applySealSchema,
  assertCanExecuteQc,
} from "@/modules/trust";

export const POST = withRoute(
  {
    auth: "staff",
    body: applySealSchema,
  },
  async ({ params, body, actor }) => {
    assertCanExecuteQc(actor);
    const { sealId } = await params;
    const result = await trustService.applySeal(sealId, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
