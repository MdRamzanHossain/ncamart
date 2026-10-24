import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ordersService, CustomerCancelOrderSchema } from "@/modules/orders";

export const POST = withRoute(
  {
    auth: "customer",
    params: z.object({
      orderNumber: z.string().min(1),
    }),
    body: CustomerCancelOrderSchema,
  },
  async ({ params, body, actor }) => {
    const cancelled = await ordersService.cancelOrderByCustomer(
      actor!.id,
      params.orderNumber,
      body.reason
    );
    return NextResponse.json(
      {
        message: "Order cancelled successfully",
        order: cancelled,
      },
      { status: 200 }
    );
  }
);
