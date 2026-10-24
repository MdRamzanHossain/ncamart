import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { paymentsService, AdminPaymentFilterSchema } from "@/modules/payments";

export const GET = withRoute(
  {
    auth: "staff",
    query: AdminPaymentFilterSchema,
  },
  async ({ query, actor }) => {
    const result = await paymentsService.listPayments(query, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
