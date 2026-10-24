import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { mediaService } from "@/modules/media";

export const POST = withRoute(
  {
    auth: "any",
  },
  async ({ actor, params }) => {
    const { id } = await params;
    const result = await mediaService.abortUpload(id, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
