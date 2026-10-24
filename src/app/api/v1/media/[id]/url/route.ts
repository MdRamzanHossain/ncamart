import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { mediaService } from "@/modules/media";

export const GET = withRoute(
  {
    auth: "public",
  },
  async ({ actor, params }) => {
    const { id } = await params;
    const result = await mediaService.getMediaUrl(id, actor);
    return NextResponse.json(result, { status: 200 });
  }
);
