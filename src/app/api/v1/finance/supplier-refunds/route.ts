import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { financeService } from "@/modules/finance";
import { supplierRefundSchema } from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: supplierRefundSchema,
  },
  async ({ body, actor }) => {
    const result = await financeService.recordSupplierRefund(body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
