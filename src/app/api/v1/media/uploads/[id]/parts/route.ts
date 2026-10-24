import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { mediaService, fetchUploadPartsSchema } from "@/modules/media";

export const POST = withRoute(
  {
    auth: "any",
    schema: fetchUploadPartsSchema,
  },
  async ({ actor, body, params }) => {
    const { id } = await params;
    const result = await mediaService.getUploadParts(id, body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
