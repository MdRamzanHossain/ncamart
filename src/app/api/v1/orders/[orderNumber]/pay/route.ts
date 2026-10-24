import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ordersService } from "@/modules/orders";

export const POST = withRoute(
  {
    auth: "customer",
    params: z.object({
      orderNumber: z.string().min(1),
    }),
  },
  async ({ params, actor }) => {
    const result = await ordersService.retryPayment(params.orderNumber, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
