import { NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { authenticator } from "otplib";
import { eq } from "drizzle-orm";
import { withRoute } from "@/lib/http/route";
import { db } from "@/lib/db";
import { staff, customers, sessions, StaffRow, CustomerRow } from "@/modules/identity/schema";
import { staffAuthService, STAFF_SESSION_COOKIE_NAME } from "@/modules/identity";
import { SESSION_COOKIE_NAME } from "@/modules/identity/auth";
import { sha256Hex, randomToken, aesGcmDecrypt } from "@/lib/crypto";
import { isValidBdPhone, normalizeBdPhone } from "@/lib/phone";

const loginSchema = z.object({
  identifier: z.string().min(1, "Username, email, or phone is required"),
  password: z.string().min(1, "Password is required"),
  totp_code: z.string().optional(),
  remember_me: z.boolean().optional(),
});

export const POST = withRoute(
  {
    auth: "public",
    body: loginSchema,
  },
  async ({ req, body }) => {
    const rawId = body.identifier.trim();
    const cleanId = rawId.toLowerCase();
    const isPhone = isValidBdPhone(cleanId);
    const normalizedPhone = isPhone ? normalizeBdPhone(cleanId) : null;

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    // 1. Check if the identifier matches a STAFF user
    let staffUser: StaffRow | null = null;
    try {
      const query = normalizedPhone
        ? db.select().from(staff).where(eq(staff.phone, normalizedPhone)).limit(1)
        : db.select().from(staff).where(eq(staff.email, cleanId)).limit(1);
      const rows = await query;
      staffUser = rows[0] ?? null;
    } catch {
      // Memory fallback if DB offline
    }

    if (staffUser) {
      if (staffUser.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "This staff account has been deactivated. Please contact Super Admin." },
          { status: 403 }
        );
      }

      // Check password
      const passwordValid = await argon2.verify(staffUser.passwordHash, body.password);
      if (!passwordValid) {
        return NextResponse.json(
          { error: "Invalid username, email, or password." },
          { status: 401 }
        );
      }

      // 2FA check for staff
      if (staffUser.totpEnabled && staffUser.totpSecretEnc) {
        if (!body.totp_code) {
          return NextResponse.json(
            {
              requires_2fa: true,
              is_staff: true,
              staff_id: staffUser.id,
              name: staffUser.fullName,
              email: staffUser.email,
              message: "Staff authentication: Please enter your 6-digit 2FA authenticator code.",
            },
            { status: 200 }
          );
        }

        // Verify 2FA code
        const secret = aesGcmDecrypt(staffUser.totpSecretEnc);
        const totpValid = authenticator.check(body.totp_code.trim(), secret);
        if (!totpValid) {
          return NextResponse.json(
            { error: "Invalid 2FA code. Please enter the current code from your authenticator app." },
            { status: 401 }
          );
        }
      }

      // Create 12-hour staff session
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
        await db.update(staff).set({ lastLoginAt: now }).where(eq(staff.id, staffUser.id));
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
            role: roles[0] || "SUPER_ADMIN",
            permissions: roles,
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

    // 2. Customer User Login
    let customer: CustomerRow | null = null;
    try {
      const query = normalizedPhone
        ? db.select().from(customers).where(eq(customers.phone, normalizedPhone)).limit(1)
        : db.select().from(customers).where(eq(customers.email, cleanId)).limit(1);
      const rows = await query;
      customer = rows[0] ?? null;
    } catch {
      // Memory fallback
    }

    const now = new Date();
    if (!customer) {
      // Create new customer account on demand
      const assignedPhone = normalizedPhone || `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const assignedEmail = !isPhone && cleanId.includes("@") ? cleanId : null;
      const assignedName = cleanId.split("@")[0] || "Customer";

      try {
        const [created] = await db
          .insert(customers)
          .values({
            phone: assignedPhone,
            email: assignedEmail,
            fullName: assignedName,
            status: "ACTIVE",
            preferredLocale: "bn",
            lastActiveAt: now,
          })
          .returning();
        customer = created;
      } catch {
        customer = {
          id: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
          phone: assignedPhone,
          email: assignedEmail,
          fullName: assignedName,
          emailVerified: false,
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
      try {
        await db
          .update(customers)
          .set({ lastActiveAt: now })
          .where(eq(customers.id, customer.id));
      } catch {
        // ignore
      }
    }

    // Issue Customer 30-day session
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
      // mock
    }

    const response = NextResponse.json(
      {
        success: true,
        is_staff: false,
        redirect_url: "/",
        session_token: sessionToken,
        user: {
          id: customer.id,
          name: customer.fullName || "Valued Customer",
          email: customer.email || undefined,
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

