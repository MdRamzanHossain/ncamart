import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { financeService } from "@/modules/finance";
import { ResolveExceptionInputSchema } from "@/modules/finance/dto";

export const POST = withRoute(
  {
    auth: "staff",
    permission: "settlement.reconcile",
    params: z.object({
      id: z.string().uuid(),
    }),
    body: ResolveExceptionInputSchema,
  },
  async ({ params, body, actor }) => {
    const exception = await financeService.resolveException(params.id, body, actor!);
    return NextResponse.json({ success: true, exception }, { status: 200 });
  }
);
