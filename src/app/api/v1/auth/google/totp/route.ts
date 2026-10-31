import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { staff, sessions } from "@/modules/identity/schema";
import { staffAuthService, STAFF_SESSION_COOKIE_NAME } from "@/modules/identity";
import { eq } from "drizzle-orm";
import { sha256Hex, randomToken, aesGcmDecrypt } from "@/lib/crypto";
import { authenticator } from "otplib";

export const dynamic = "force-dynamic";

const verifyGoogleTotpSchema = z.object({
  totp_code: z.string().min(6).max(8),
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = verifyGoogleTotpSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter your 6-digit TOTP code." },
        { status: 400 }
      );
    }

    const { totp_code, email: submittedEmail } = parsed.data;

    // Check pending cookie or submitted email
    const pendingCookie = req.cookies.get("nca_pending_google_2fa")?.value;
    let staffEmail = submittedEmail?.trim().toLowerCase() || "";

    if (pendingCookie) {
      try {
        const decrypted = aesGcmDecrypt(pendingCookie);
        const payload = JSON.parse(decrypted);
        if (payload.email && payload.exp > Date.now()) {
          staffEmail = payload.email.trim().toLowerCase();
        }
      } catch {
        // Fallback to submittedEmail
      }
    }

    if (!staffEmail) {
      return NextResponse.json(
        { error: "Google 2FA challenge expired. Please sign in with Google again." },
        { status: 400 }
      );
    }

    // Look up staff user
    const staffRows = await db
      .select()
      .from(staff)
      .where(eq(staff.email, staffEmail))
      .limit(1);
    const staffUser = staffRows[0] ?? null;

    if (!staffUser || staffUser.status !== "ACTIVE" || !staffUser.totpSecretEnc) {
      return NextResponse.json(
        { error: "Staff account not found or 2FA not configured." },
        { status: 404 }
      );
    }

    // Decrypt and verify TOTP code
    const secret = aesGcmDecrypt(staffUser.totpSecretEnc);
    const isValid = authenticator.check(totp_code.trim(), secret);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid 6-digit 2FA code. Please check your Authenticator app and try again." },
        { status: 401 }
      );
    }

    // Issue 12-hour staff session
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;
    const sessionToken = randomToken(32);
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

    try {
      await db.insert(sessions).values({
        tokenHash,
        subjectType: "STAFF",
        subjectId: staffUser.id,
        ip: clientIp,
        userAgent,
        ownershipUnconfirmed: false,
        expiresAt,
      });
    } catch {
      staffAuthService.setMemoryStaffSession(sessionToken, staffUser.id);
    }

    const response = NextResponse.json(
      {
        success: true,
        redirect_url: "/admin",
        message: "2FA verified successfully.",
      },
      { status: 200 }
    );

    const isProd = process.env.NODE_ENV === "production";
    response.cookies.set(STAFF_SESSION_COOKIE_NAME, sessionToken, {
      path: "/",
      maxAge: 43200,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    });

    // Clear pending challenge cookie
    response.cookies.set("nca_pending_google_2fa", "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "2FA verification failed." },
      { status: 500 }
    );
  }
}

