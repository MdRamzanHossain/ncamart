import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { preorderService } from "@/modules/preorder";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  async ({ params, actor }) => {
    const updated = await preorderService.markQcVerified(params.id, actor!);
    return NextResponse.json(
      {
        message: "Pre-order QC verified and balance due date set",
        order: updated,
      },
      { status: 200 }
    );
  }
);
