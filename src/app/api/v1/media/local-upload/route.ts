import { NextRequest, NextResponse } from "next/server";
import { putObject, getObject } from "@/lib/storage";

/**
 * Local cPanel Disk Storage Upload & Download Handler
 *
 * Used automatically when S3_ENDPOINT=local so pictures, QC videos, and PDFs
 * are stored directly on the ExonHost cPanel filesystem (public/uploads/<bucket>/<key>)
 * without requiring Cloudflare R2 or AWS S3.
 */
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket") || "ncamart-media";
  const key = searchParams.get("key");
  const contentType =
    searchParams.get("contentType") ||
    req.headers.get("content-type") ||
    "application/octet-stream";

  if (!key) {
    return NextResponse.json(
      { error: { code: "ERR_VALIDATION", message: "Missing storage key" } },
      { status: 400 }
    );
  }

  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await putObject(bucket, key, buffer, contentType);

  return new NextResponse(null, {
    status: 200,
    headers: {
      ETag: `"local-${buffer.length}"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket") || "ncamart-media";
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json(
      { error: { code: "ERR_VALIDATION", message: "Missing storage key" } },
      { status: 400 }
    );
  }

  const obj = await getObject(bucket, key);
  if (!obj) {
    return NextResponse.json(
      { error: { code: "ERR_NOT_FOUND", message: "Media file not found on disk" } },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(obj.body), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

