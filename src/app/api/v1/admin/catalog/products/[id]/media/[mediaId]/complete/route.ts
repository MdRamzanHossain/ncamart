import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService } from "@/modules/catalog";
import { NextResponse } from "next/server";

const paramsSchema = z.object({
  id: z.string(),
  mediaId: z.string(),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    const media = await catalogService.completeImageUpload(params.id, params.mediaId, actor!);
    return NextResponse.json(media, { status: 200 });
  }
);
