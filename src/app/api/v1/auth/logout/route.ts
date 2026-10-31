import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { authService, SESSION_COOKIE_NAME, STAFF_SESSION_COOKIE_NAME } from "@/modules/identity";
import { db } from "@/lib/db";
import { sessions } from "@/modules/identity/schema";
import { eq } from "drizzle-orm";
import { sha256Hex } from "@/lib/crypto";

export const POST = withRoute(
  {
    auth: "any",
  },
  async ({ actor, req }) => {
    // 1. If actor is resolved with a session ID, revoke in DB
    if (actor?.sessionId) {
      await authService.revokeSession(actor.sessionId, actor.id).catch(() => {});
    }

    // 2. Also check cookies explicitly in case session was in memory or unparsed
    const token =
      req.cookies.get(SESSION_COOKIE_NAME)?.value ||
      req.cookies.get(STAFF_SESSION_COOKIE_NAME)?.value ||
      req.cookies.get("nca_staff_sid")?.value;

    if (token) {
      const tokenHash = sha256Hex(token);
      try {
        await db
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.tokenHash, tokenHash));
      } catch {
        // DB update error ignore
      }
    }

    const res = NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 }
    );

    const isProd = process.env.NODE_ENV === "production";
    const cookieOpts = {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax" as const,
      secure: isProd,
    };

    // Clear all potential auth cookies
    res.cookies.set(SESSION_COOKIE_NAME, "", cookieOpts);
    res.cookies.set(STAFF_SESSION_COOKIE_NAME, "", cookieOpts);
    res.cookies.set("nca_staff_sid", "", cookieOpts);
    res.cookies.set("nca_auth_sync", "", { ...cookieOpts, httpOnly: false });

    return res;
  }
);
