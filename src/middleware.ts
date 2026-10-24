import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "node:crypto";

export const DEVICE_COOKIE_NAME = "nca_did";
const TWO_YEARS_SECONDS = 60 * 60 * 24 * 365 * 2;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
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

  return response;
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
