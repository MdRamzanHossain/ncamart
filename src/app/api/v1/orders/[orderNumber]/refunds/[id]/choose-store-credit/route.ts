import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { refundsService, chooseStoreCreditSchema } from "@/modules/payments";

export const POST = withRoute(
  {
    auth: "customer",
    params: z.object({
      orderNumber: z.string().min(1),
      id: z.string().min(1),
    }),
    body: chooseStoreCreditSchema.optional(),
  },
  async ({ actor, params, body }) => {
    const refund = await refundsService.chooseStoreCredit(
      actor!,
      params.orderNumber,
      params.id,
      body
    );
    return NextResponse.json({ success: true, refund }, { status: 200 });
  }
);
