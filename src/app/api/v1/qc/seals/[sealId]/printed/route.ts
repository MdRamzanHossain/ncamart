import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { trustService, assertCanPrintSeal } from "@/modules/trust";

export const POST = withRoute(
  {
    auth: "staff",
  },
  async ({ params, actor }) => {
    assertCanPrintSeal(actor);
    const { sealId } = await params;
    const seal = await trustService.markSealPrinted(sealId, actor!);
    return NextResponse.json(seal, { status: 200 });
  }
);
