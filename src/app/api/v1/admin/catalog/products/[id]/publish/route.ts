import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService } from "@/modules/catalog";
import { NextResponse } from "next/server";

const paramsSchema = z.object({
  id: z.string(),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.publish", // SUPER_ADMIN
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    const product = await catalogService.publishProduct(params.id, actor!);
    return NextResponse.json(
      {
        success: true,
        is_published: true,
        product,
      },
      { status: 200 }
    );
  }
);
