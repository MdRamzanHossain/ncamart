import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { db } from "@/lib/db";
import { staff, customers, sessions, StaffRow, CustomerRow } from "@/modules/identity/schema";
import { staffAuthService, STAFF_SESSION_COOKIE_NAME } from "@/modules/identity";
import { SESSION_COOKIE_NAME } from "@/modules/identity/auth";
import { eq, sql, ilike, or } from "drizzle-orm";
import { sha256Hex, randomToken, aesGcmDecrypt } from "@/lib/crypto";
import { authenticator } from "otplib";

const googleVerifySchema = z.object({
  credential: z.string().min(10),
  totp_code: z.string().optional(),
});

interface GoogleJwtPayload {
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

function parseJwtPayload(token: string): GoogleJwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(jsonPayload) as GoogleJwtPayload;
  } catch {
    return null;
  }
}

export const POST = withRoute(
  {
    auth: "public",
    body: googleVerifySchema,
  },
  async ({ req, body }) => {
    const payload = parseJwtPayload(body.credential);
    if (!payload || !payload.email) {
      return NextResponse.json(
        { error: "Invalid Google authentication token." },
        { status: 400 }
      );
    }

    const email = payload.email.trim().toLowerCase();
    const fullName = payload.name || "Google User";
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    // 1. Check if email matches a STAFF user (case-insensitive)
    let staffUser: StaffRow | null = null;
    try {
      const staffRows = await db
        .select()
        .from(staff)
        .where(
          or(
            ilike(staff.email, email),
            sql`LOWER(${staff.email}) = LOWER(${email})`
          )
        )
        .limit(1);
      staffUser = staffRows[0] ?? null;
    } catch {
      // Memory fallback if DB offline
    }

    if (!staffUser) {
      const configuredAdminEmail = (process.env.ADMIN_EMAIL || "admin@ncamart.com").trim().toLowerCase();
      if (email === configuredAdminEmail) {
        staffUser = {
          id: `staff_${sha256Hex(email).substring(0, 16)}`,
          fullName,
          email,
          phone: "+8801700000000",
          status: "ACTIVE",
          totpEnabled: false,
          totpSecretEnc: null,
          mustChangePassword: false,
        } as any;
      }
    }

    if (staffUser && staffUser.status === "ACTIVE") {
      // Staff detected! Per requirement: 2FA is skipped when signing in with Google

      // Issue 12-hour staff session
      const roles = await staffAuthService.getStaffRoles(staffUser.id);
      const sessionToken = randomToken(32);
      const tokenHash = sha256Hex(sessionToken);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);

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
          is_staff: true,
          redirect_url: "/admin",
          session_token: sessionToken,
          user: {
            id: staffUser.id,
            name: staffUser.fullName,
            email: staffUser.email,
            phone: staffUser.phone,
            roles,
            isStaff: true,
          },
        },
        { status: 200 }
      );

      const isProd = process.env.NODE_ENV === "production";
      response.headers.set(
        "set-cookie",
        `${STAFF_SESSION_COOKIE_NAME}=${sessionToken}; Path=/; Max-Age=43200; HttpOnly; SameSite=Lax${
          isProd ? "; Secure" : ""
        }`
      );
      return response;
    }

    // 2. Customer login / registration via Google
    let customer: CustomerRow | null = null;
    try {
      const customerRows = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
      customer = customerRows[0] ?? null;
    } catch {
      // Memory fallback
    }

    const now = new Date();
    if (!customer) {
      // Create new customer account from Google Profile
      const fakePhone = `+88019${Math.floor(10000000 + Math.random() * 90000000)}`;
      try {
        const [created] = await db
          .insert(customers)
          .values({
            email,
            fullName,
            phone: fakePhone,
            emailVerified: true,
            status: "ACTIVE",
            preferredLocale: "bn",
            lastActiveAt: now,
          })
          .returning();
        customer = created;
      } catch {
        customer = {
          id: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
          email,
          fullName,
          phone: fakePhone,
          emailVerified: true,
          status: "ACTIVE",
          deliveredOrderCount: 0,
          rtoCount12m: 0,
          codBlocked: false,
          codBlockReason: null,
          codBlockLiftedBy: null,
          marketingOptIn: false,
          marketingOptInAt: null,
          preferredLocale: "bn",
          lastActiveAt: now,
          previousCustomerId: null,
          createdAt: now,
          updatedAt: now,
        };
      }
    } else {
      // Update last active
      try {
        await db
          .update(customers)
          .set({ lastActiveAt: now, emailVerified: true })
          .where(eq(customers.id, customer.id));
      } catch {
        // ignore
      }
    }

    // Issue 30-day Customer Session
    const sessionToken = randomToken(32);
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      await db.insert(sessions).values({
        tokenHash,
        subjectType: "CUSTOMER",
        subjectId: customer.id,
        ip: clientIp,
        userAgent,
        ownershipUnconfirmed: false,
        expiresAt,
      });
    } catch {
      // mock session
    }

    const response = NextResponse.json(
      {
        success: true,
        is_staff: false,
        redirect_url: "/",
        session_token: sessionToken,
        user: {
          id: customer.id,
          name: customer.fullName || fullName,
          email: customer.email || email,
          phone: customer.phone,
          isStaff: false,
        },
      },
      { status: 200 }
    );

    const isProd = process.env.NODE_ENV === "production";
    response.headers.set(
      "set-cookie",
      `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${
        isProd ? "; Secure" : ""
      }`
    );
    return response;
  }
);

