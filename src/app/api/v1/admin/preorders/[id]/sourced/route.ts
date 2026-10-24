import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { preorderService, AdminPreorderSourcedSchema } from "@/modules/preorder";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().uuid(),
    }),
    body: AdminPreorderSourcedSchema,
  },
  async ({ params, body, actor }) => {
    const updated = await preorderService.markSourced(params.id, body, actor!);
    return NextResponse.json(
      {
        message: "Pre-order marked as sourced in transit",
        order: updated,
      },
      { status: 200 }
    );
  }
);
