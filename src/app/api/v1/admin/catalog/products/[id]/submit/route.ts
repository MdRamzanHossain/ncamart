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
    permission: "catalog.draft",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    const result = await catalogService.submitProductForReview(params.id, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
