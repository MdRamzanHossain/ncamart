import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { preorderService, AdminPreorderImportFailedSchema } from "@/modules/preorder";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({
      id: z.string().uuid(),
    }),
    body: AdminPreorderImportFailedSchema,
  },
  async ({ params, body, actor }) => {
    const updated = await preorderService.markImportFailed(
      params.id,
      body,
      actor!
    );
    return NextResponse.json(
      {
        message: "Pre-order import marked failed; full refund or switch offered to customer",
        order: updated,
      },
      { status: 200 }
    );
  }
);
