import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { mediaService, initiateUploadSchema } from "@/modules/media";

export const POST = withRoute(
  {
    auth: "any",
    schema: initiateUploadSchema,
  },
  async ({ actor, body }) => {
    const result = await mediaService.initiateUpload(body, actor!);
    return NextResponse.json(result, { status: 201 });
  }
);
