import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { financeService } from "@/modules/finance";

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor }) => {
    const payables = await financeService.getSupplierPayables(actor!);
    return NextResponse.json({ payables }, { status: 200 });
  }
);
