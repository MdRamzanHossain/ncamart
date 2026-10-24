import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { preorderService, CustomerBalancePaymentSchema } from "@/modules/preorder";

export const POST = withRoute(
  {
    auth: "customer",
    params: z.object({
      orderNumber: z.string().min(1),
    }),
    body: CustomerBalancePaymentSchema,
  },
  async ({ params, body, actor }) => {
    const result = await preorderService.payBalance(
      actor!.id,
      params.orderNumber,
      {
        ...body,
        store_credit_paisa: body.store_credit_paisa ?? 0,
      }
    );
    return NextResponse.json(result, { status: 200 });
  }
);
