import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { trustService, resolveGeoDistrict } from "@/modules/trust";
import { RateLimitError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      {
        is_valid: false,
        message: "Invalid Seal ID. Check label or enter without spaces.",
      },
      { status: 404 }
    );
  }

  // Extract or generate anonymous device ID
  let deviceId = req.cookies.get("nca_did")?.value || req.headers.get("x-device-id");
  let isNewDevice = false;
  if (!deviceId) {
    deviceId = `did_${crypto.randomUUID()}`;
    isNewDevice = true;
  }

  // Extract client IP and user agent
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : req.headers.get("x-real-ip") || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const geoDistrict = resolveGeoDistrict(req.headers);
  const isQr = searchParams.get("qr") === "1" || searchParams.get("qr") === "true";
  const turnstileToken = req.headers.get("x-turnstile-token") || searchParams.get("turnstile_token");

  try {
    const result = await trustService.verifyLookup({
      inputQuery: q,
      deviceId,
      ip: clientIp,
      userAgent,
      geoDistrict,
      isQr,
      turnstileToken,
    });

    if (result.notFound) {
      const res = NextResponse.json(result.response, { status: 404 });
      if (isNewDevice) {
        res.cookies.set("nca_did", deviceId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 365 * 24 * 60 * 60,
          path: "/",
        });
      }
      return res;
    }

    const res = NextResponse.json(result.response, { status: 200 });
    if (isNewDevice) {
      res.cookies.set("nca_did", deviceId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    }
    return res;
  } catch (err: any) {
    if (err instanceof RateLimitError || err.status === 429) {
      const res = NextResponse.json(
        {
          error: {
            code: err.code || "ERR_RATE_LIMIT_EXCEEDED",
            message: err.message,
            status: 429,
            challenge: "turnstile",
          },
          challenge: "turnstile",
        },
        { status: 429 }
      );
      if (err.retryAfterSec) {
        res.headers.set("Retry-After", String(err.retryAfterSec));
      }
      return res;
    }

    throw err;
  }
}
