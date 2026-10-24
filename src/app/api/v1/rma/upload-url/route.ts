import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { mediaService, rmaUploadUrlSchema } from "@/modules/media";

export const POST = withRoute(
  {
    auth: "any",
    schema: rmaUploadUrlSchema,
  },
  async ({ actor, body }) => {
    const result = await mediaService.initiateRmaUploadUrl(body, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
