import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ordersService, orderStatusEnum, orderTypeEnum } from "@/modules/orders";

const QuerySchema = z.object({
  status: z.enum(orderStatusEnum).optional(),
  type: z.enum(orderTypeEnum).optional(),
  order_type: z.enum(orderTypeEnum).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const GET = withRoute(
  {
    auth: "customer",
    query: QuerySchema,
  },
  async ({ query, actor }) => {
    const orderType = query.type || query.order_type;
    const result = await ordersService.getCustomerOrders(actor!.id, {
      status: query.status,
      orderType,
      page: query.page,
      limit: query.limit,
    });
    return NextResponse.json(result, { status: 200 });
  }
);
