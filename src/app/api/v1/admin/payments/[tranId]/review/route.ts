import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { paymentsService, AdminPaymentReviewSchema } from "@/modules/payments";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      tranId: z.string().min(1),
    }),
    body: AdminPaymentReviewSchema,
  },
  async ({ params, body, actor }) => {
    const result = await paymentsService.adminReviewPayment(
      params.tranId,
      body.decision,
      actor!,
      body.notes
    );
    return NextResponse.json(result, { status: 200 });
  }
);
