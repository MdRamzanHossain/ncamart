import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { preorderService, AdminPreorderRepricingSchema } from "@/modules/preorder";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().uuid(),
    }),
    body: AdminPreorderRepricingSchema,
  },
  async ({ params, body, actor }) => {
    const updated = await preorderService.repricePreorder(
      params.id,
      body,
      actor!
    );
    return NextResponse.json(
      {
        message: "Spot repricing initiated with 48h deadline",
        order: updated,
      },
      { status: 200 }
    );
  }
);
