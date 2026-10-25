import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { supportTasksService } from "@/modules/identity/supportTasksService";
import { supportTaskStatusEnum, supportTaskTypeEnum } from "@/modules/preorder/schema";

const querySchema = z.object({
  status: z.enum(supportTaskStatusEnum).optional(),
  type: z.enum(supportTaskTypeEnum).optional(),
  assigned_to: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "support.manage",
    query: querySchema,
  },
  async ({ query }) => {
    const result = await supportTasksService.listTasks({
      status: query.status,
      type: query.type,
      assignedTo: query.assigned_to,
      customerId: query.customer_id,
      orderId: query.order_id,
      page: query.page,
      limit: query.limit,
    });
    return NextResponse.json(result, { status: 200 });
  }
);
