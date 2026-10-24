import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { posService, verifyPickupPinSchema } from "@/modules/pos";

export const POST = withRoute(
  {
    auth: "staff",
    schema: verifyPickupPinSchema,
  },
  async ({ actor, body }) => {
    const result = await posService.verifyPickupPin(body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
