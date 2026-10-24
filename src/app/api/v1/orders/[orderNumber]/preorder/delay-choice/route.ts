import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { preorderService, CustomerDelayChoiceSchema } from "@/modules/preorder";

export const POST = withRoute(
  {
    auth: "customer",
    params: z.object({
      orderNumber: z.string().min(1),
    }),
    body: CustomerDelayChoiceSchema,
  },
  async ({ params, body, actor }) => {
    const result = await preorderService.handleDelayChoice(
      actor!.id,
      params.orderNumber,
      body
    );
    return NextResponse.json(result, { status: 200 });
  }
);
