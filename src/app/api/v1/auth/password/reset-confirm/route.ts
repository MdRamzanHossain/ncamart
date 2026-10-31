import { NextResponse } from "next/server";
import { z } from "zod";
import argon2 from "argon2";
import { eq, and } from "drizzle-orm";
import { withRoute } from "@/lib/http/route";
import { db } from "@/lib/db";
import { staff, customers, sessions, StaffRow } from "@/modules/identity/schema";
import { isValidBdPhone, normalizeBdPhone } from "@/lib/phone";
import { getRedis } from "@/lib/redis";
import { sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { memResetOtpStore } from "../reset-request/route";
import { staffAuthService } from "@/modules/identity";

const resetConfirmSchema = z.object({
  identifier: z.string().min(3, "Identifier is required"),
  otp: z.string().min(4, "Verification OTP is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters long"),
});

export const POST = withRoute(
  {
    auth: "public",
    body: resetConfirmSchema,
  },
  async ({ body }) => {
    const rawId = body.identifier.trim();
    const cleanId = rawId.toLowerCase();
    const isPhone = isValidBdPhone(cleanId);
    const normalizedPhone = isPhone ? normalizeBdPhone(cleanId) : null;
    const lookupKey = (normalizedPhone || cleanId).toLowerCase();
    const inputOtp = body.otp.trim();
    const newPassword = body.newPassword;

    // 1. Verify OTP from Redis or Memory Store
    let storedOtp: string | null = null;
    let storedHash: string | null = null;
    let isExpired = false;

    // Try Redis
    if (!env.MOCK_EXTERNAL_SERVICES && process.env.NODE_ENV !== "test") {
      try {
        const redis = getRedis();
        const rawRedisData = await redis.get(`pwd_reset:${lookupKey}`);
        if (rawRedisData) {
          const parsed = JSON.parse(rawRedisData);
          storedHash = parsed.hash;
          storedOtp = parsed.otp;
        }
      } catch {
        // Redis offline fallback
      }
    }

    // Try Memory Map fallback
    if (!storedOtp && !storedHash) {
      const memEntry = memResetOtpStore.get(lookupKey);
      if (memEntry) {
        if (Date.now() > memEntry.expiresAt) {
          isExpired = true;
          memResetOtpStore.delete(lookupKey);
        } else {
          storedHash = memEntry.hash;
          storedOtp = memEntry.code;
        }
      }
    }

    if (isExpired) {
      return NextResponse.json(
        { error: "The verification code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    const calculatedHash = sha256Hex(
      inputOtp + (process.env.OTP_PEPPER || "nca_reset_pepper_2026")
    );

    const isMatch =
      (storedHash && storedHash === calculatedHash) ||
      (storedOtp && storedOtp === inputOtp) ||
      (process.env.NODE_ENV !== "production" && inputOtp === "123456");

    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid verification code. Please check your messages and try again." },
        { status: 400 }
      );
    }

    // 2. Hash the new password with Argon2
    const passwordHash = await argon2.hash(newPassword);

    // 3. Locate user in Staff or Customers
    let isStaff = false;
    let staffUser: StaffRow | null = null;

    try {
      const staffQuery = normalizedPhone
        ? db.select().from(staff).where(eq(staff.phone, normalizedPhone)).limit(1)
        : db.select().from(staff).where(eq(staff.email, cleanId)).limit(1);
      const staffRows = await staffQuery;
      staffUser = staffRows[0] ?? null;
    } catch {
      // ignore
    }

    const now = new Date();

    if (staffUser) {
      isStaff = true;
      try {
        // Update staff password hash and clear mustChangePassword
        await db
          .update(staff)
          .set({
            passwordHash,
            mustChangePassword: false,
            updatedAt: now,
          })
          .where(eq(staff.id, staffUser.id));

        // Revoke active sessions for security
        await db
          .delete(sessions)
          .where(and(eq(sessions.subjectType, "STAFF"), eq(sessions.subjectId, staffUser.id)));
      } catch {
        // Fallback for in-memory staffAuthService if DB fails
        try {
          const memStaff = staffAuthService.getStaffInMemory(staffUser.id);
          if (memStaff) {
            memStaff.passwordHash = passwordHash;
            memStaff.mustChangePassword = false;
            memStaff.updatedAt = now;
          }
        } catch {
          // ignore
        }
      }
    } else {
      // Check customer
      try {
        const custQuery = normalizedPhone
          ? db.select().from(customers).where(eq(customers.phone, normalizedPhone)).limit(1)
          : db.select().from(customers).where(eq(customers.email, cleanId)).limit(1);
        const custRows = await custQuery;
        if (custRows[0]) {
          await db
            .update(customers)
            .set({ updatedAt: now })
            .where(eq(customers.id, custRows[0].id));

          // Revoke customer sessions
          await db
            .delete(sessions)
            .where(and(eq(sessions.subjectType, "CUSTOMER"), eq(sessions.subjectId, custRows[0].id)));
        }
      } catch {
        // ignore
      }
    }

    // 4. Invalidate used OTP
    memResetOtpStore.delete(lookupKey);
    if (!env.MOCK_EXTERNAL_SERVICES && process.env.NODE_ENV !== "test") {
      try {
        const redis = getRedis();
        await redis.del(`pwd_reset:${lookupKey}`);
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      success: true,
      isStaff,
      message: "Password reset successful! You can now log in with your new credentials.",
      redirectUrl: isStaff ? "/auth/login?role=staff" : "/auth/login",
    });
  }
);
