import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { posService, pickupHandoverSchema } from "@/modules/pos";

export const POST = withRoute(
  {
    auth: "staff",
    schema: pickupHandoverSchema,
  },
  async ({ actor, body, req }) => {
    const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;
    const result = await posService.handoverPickup(body, actor!, idempotencyKey);
    return NextResponse.json(result, { status: 200 });
  }
);
