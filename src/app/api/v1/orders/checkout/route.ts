import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { ordersService, CheckoutInputSchema } from "@/modules/orders";

export const POST = withRoute(
  {
    auth: "customer",
    idempotent: "checkout",
    body: CheckoutInputSchema,
  },
  async ({ body, actor, req }) => {
    const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;
    const result = await ordersService.checkout(body, actor!, idempotencyKey);
    return NextResponse.json(result, { status: 201 });
  }
);
