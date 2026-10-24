import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ordersService } from "@/modules/orders";

export const GET = withRoute(
  {
    auth: "customer",
    params: z.object({
      orderNumber: z.string().min(1),
    }),
  },
  async ({ params, actor }) => {
    const detail = await ordersService.getCustomerOrderDetail(
      actor!.id,
      params.orderNumber
    );
    return NextResponse.json(detail, { status: 200 });
  }
);
