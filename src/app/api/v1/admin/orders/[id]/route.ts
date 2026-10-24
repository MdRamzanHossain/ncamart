import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ordersService } from "@/modules/orders";

export const GET = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  async ({ params, actor }) => {
    const detail = await ordersService.getAdminOrderDetail(actor!, params.id);
    return NextResponse.json(detail, { status: 200 });
  }
);
