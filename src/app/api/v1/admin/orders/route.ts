import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import {
  ordersService,
  orderStatusEnum,
  orderTypeEnum,
  orderChannelEnum,
} from "@/modules/orders";

const AdminOrdersQuerySchema = z.object({
  status: z.enum(orderStatusEnum).optional(),
  type: z.enum(orderTypeEnum).optional(),
  order_type: z.enum(orderTypeEnum).optional(),
  channel: z.enum(orderChannelEnum).optional(),
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
  phone: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const GET = withRoute(
  {
    auth: "staff",
    query: AdminOrdersQuerySchema,
  },
  async ({ query, actor }) => {
    const orderType = query.type || query.order_type;
    const result = await ordersService.getAdminOrders(actor!, {
      status: query.status,
      orderType,
      channel: query.channel,
      fromDate: query.from_date,
      toDate: query.to_date,
      phone: query.phone,
      page: query.page,
      limit: query.limit,
    });

    return NextResponse.json(
      {
        items: result.orders,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
        },
      },
      { status: 200 }
    );
  }
);
