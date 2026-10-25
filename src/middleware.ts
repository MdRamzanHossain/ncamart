import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "node:crypto";

export const DEVICE_COOKIE_NAME = "nca_did";
const TWO_YEARS_SECONDS = 60 * 60 * 24 * 365 * 2;

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const isOptions = request.method === "OPTIONS";

  // Check CORS allowed origins
  const envAllowed = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const requestOriginLower = origin ? origin.toLowerCase() : null;
  const isAllowedOrigin =
    Boolean(requestOriginLower) &&
    (requestOriginLower === request.nextUrl.origin.toLowerCase() ||
      envAllowed.includes(requestOriginLower!));

  // If preflight OPTIONS request
  if (isOptions) {
    if (origin && isAllowedOrigin) {
      const preflightResponse = new NextResponse(null, { status: 204 });
      preflightResponse.headers.set("Access-Control-Allow-Origin", origin);
      preflightResponse.headers.set("Access-Control-Allow-Credentials", "true");
      preflightResponse.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS, PATCH"
      );
      preflightResponse.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, X-Idempotency-Key"
      );
      preflightResponse.headers.set("Access-Control-Max-Age", "86400");
      applySecurityHeaders(preflightResponse);
      return preflightResponse;
    }

    if (origin && !isAllowedOrigin) {
      // CORS rejected
      const forbidden = new NextResponse(JSON.stringify({ error: "CORS not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
      applySecurityHeaders(forbidden);
      return forbidden;
    }
  }

  const response = NextResponse.next();

  // Apply CORS headers on regular responses if allowed origin
  if (origin && isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // Device cookie identification
  const existingDid = request.cookies.get(DEVICE_COOKIE_NAME)?.value;
  if (!existingDid) {
    const newDid = crypto.randomUUID();
    response.cookies.set({
      name: DEVICE_COOKIE_NAME,
      value: newDid,
      maxAge: TWO_YEARS_SECONDS,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  // Apply Security Headers (PRD §3.18, architechture.md §18)
  applySecurityHeaders(response);

  return response;
}

export function applySecurityHeaders(response: NextResponse | Response): void {
  // HSTS (HTTP Strict Transport Security)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking / frame embedding
  response.headers.set("X-Frame-Options", "DENY");
  // Strict Referrer Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; default-src 'self'"
  );
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
