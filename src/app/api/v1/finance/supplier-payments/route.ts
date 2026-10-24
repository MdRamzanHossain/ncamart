import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { financeService } from "@/modules/finance";
import { supplierPaymentSchema } from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: supplierPaymentSchema,
  },
  async ({ body, actor }) => {
    const result = await financeService.recordSupplierPayment(body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
