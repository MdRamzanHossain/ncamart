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
    const updated = await preorderService.markArrived(params.id, actor!);
    return NextResponse.json(
      {
        message: "Pre-order arrived at godown and received into QC_HOLD",
        order: updated,
      },
      { status: 200 }
    );
  }
);
