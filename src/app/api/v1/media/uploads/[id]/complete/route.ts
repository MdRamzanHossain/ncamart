import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { mediaService, completeUploadSchema } from "@/modules/media";

export const POST = withRoute(
  {
    auth: "any",
    schema: completeUploadSchema,
  },
  async ({ actor, body, params }) => {
    const { id } = await params;
    const media = await mediaService.completeUpload(id, body, actor!);
    return NextResponse.json(
      {
        success: true,
        media: {
          id: media.id,
          status: media.status,
          kind: media.kind,
          storage_key: media.storageKey,
          size_bytes: media.sizeBytes,
          content_type: media.contentType,
          duration_seconds: media.durationSeconds,
          is_public: media.isPublic,
          flagged: media.flagged,
          flag_reason: media.flagReason,
        },
      },
      { status: 200 }
    );
  }
);
