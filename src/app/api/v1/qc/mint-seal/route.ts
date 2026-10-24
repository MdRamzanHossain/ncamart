import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  trustService,
  mintSealSchema,
  assertCanPrintSeal,
} from "@/modules/trust";

export const POST = withRoute(
  {
    auth: "staff",
    body: mintSealSchema,
  },
  async ({ body, actor }) => {
    assertCanPrintSeal(actor);
    const result = await trustService.mintSeal(body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
