import { z } from "zod";
import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { sourcingService, stockoutChoiceSchema } from "@/modules/sourcing";

const paramsSchema = z.object({
  orderNumber: z.string().min(1),
  lineId: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "any",
    params: paramsSchema,
    body: stockoutChoiceSchema,
  },
  async ({ params, body, actor }) => {
    const result = await sourcingService.handleStockoutChoice(
      params.orderNumber,
      params.lineId,
      body,
      actor
    );
    return NextResponse.json(result, { status: 200 });
  }
);
