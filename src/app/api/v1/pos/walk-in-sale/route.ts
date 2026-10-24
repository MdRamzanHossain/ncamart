import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { posService, walkInSaleSchema } from "@/modules/pos";

export const POST = withRoute(
  {
    auth: "staff",
    schema: walkInSaleSchema,
  },
  async ({ actor, body, req }) => {
    const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;
    const result = await posService.executeWalkInSale(body, actor!, idempotencyKey);
    return NextResponse.json(result, { status: 201 });
  }
);
