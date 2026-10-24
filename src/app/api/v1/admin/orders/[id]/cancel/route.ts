import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ordersService, AdminCancelOrderSchema } from "@/modules/orders";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().uuid(),
    }),
    body: AdminCancelOrderSchema,
  },
  async ({ params, body, actor }) => {
    const cancelled = await ordersService.cancelOrderByStaff(
      actor!,
      params.id,
      body.reason
    );
    return NextResponse.json(
      {
        message: "Order cancelled by staff successfully",
        order: cancelled,
      },
      { status: 200 }
    );
  }
);
