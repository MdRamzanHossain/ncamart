import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { withRoute } from "@/lib/http/route";
import { db } from "@/lib/db";
import { staff, customers } from "@/modules/identity/schema";
import { defaultProviders } from "@/modules/notifications/providers";
import { isValidBdPhone, normalizeBdPhone } from "@/lib/phone";
import { getRedis } from "@/lib/redis";
import { sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";

// In-Memory store fallback for reset OTPs
export interface ResetOtpEntry {
  hash: string;
  code: string;
  target: string;
  channel: "sms" | "whatsapp" | "email";
  isStaff: boolean;
  expiresAt: number;
}
export const memResetOtpStore = new Map<string, ResetOtpEntry>();

const resetRequestSchema = z.object({
  identifier: z.string().min(3, "Phone number or email is required"),
  channel: z.enum(["sms", "whatsapp", "email"]).default("sms"),
});

export const POST = withRoute(
  {
    auth: "public",
    body: resetRequestSchema,
  },
  async ({ body }) => {
    const rawId = body.identifier.trim();
    const cleanId = rawId.toLowerCase();
    const isPhone = isValidBdPhone(cleanId);
    const normalizedPhone = isPhone ? normalizeBdPhone(cleanId) : null;
    const channel = body.channel;

    // 1. Locate user in staff or customer records
    let isStaff = false;
    let targetPhone: string | null = null;
    let targetEmail: string | null = null;
    let userName = "Valued Member";

    try {
      // Check Staff first
      const staffQuery = normalizedPhone
        ? db.select().from(staff).where(eq(staff.phone, normalizedPhone)).limit(1)
        : db.select().from(staff).where(eq(staff.email, cleanId)).limit(1);
      const staffRows = await staffQuery;
      if (staffRows[0]) {
        isStaff = true;
        targetPhone = staffRows[0].phone;
        targetEmail = staffRows[0].email;
        userName = staffRows[0].fullName;
      }
    } catch {
      // ignore
    }

    if (!isStaff) {
      try {
        // Check Customers
        const custQuery = normalizedPhone
          ? db.select().from(customers).where(eq(customers.phone, normalizedPhone)).limit(1)
          : db.select().from(customers).where(eq(customers.email, cleanId)).limit(1);
        const custRows = await custQuery;
        if (custRows[0]) {
          targetPhone = custRows[0].phone;
          targetEmail = custRows[0].email;
          userName = custRows[0].fullName || "Customer";
        }
      } catch {
        // ignore
      }
    }

    // If identifier was a phone number, fallback targetPhone to it
    if (!targetPhone && normalizedPhone) {
      targetPhone = normalizedPhone;
    }
    if (!targetEmail && cleanId.includes("@")) {
      targetEmail = cleanId;
    }

    // 2. Validate channel availability for this user
    if ((channel === "sms" || channel === "whatsapp") && !targetPhone) {
      return NextResponse.json(
        {
          error: "No registered mobile phone number found for this account. Please select Email.",
        },
        { status: 400 }
      );
    }

    if (channel === "email" && !targetEmail) {
      return NextResponse.json(
        {
          error: "No registered email address found for this account. Please select SMS or WhatsApp.",
        },
        { status: 400 }
      );
    }

    // 3. Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = sha256Hex(otp + (process.env.OTP_PEPPER || "nca_reset_pepper_2026"));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes TTL

    // Store in memory & Redis
    const lookupKey = (normalizedPhone || cleanId).toLowerCase();
    memResetOtpStore.set(lookupKey, {
      hash: otpHash,
      code: otp,
      target: channel === "email" ? (targetEmail as string) : (targetPhone as string),
      channel,
      isStaff,
      expiresAt,
    });

    if (!env.MOCK_EXTERNAL_SERVICES && process.env.NODE_ENV !== "test") {
      try {
        const redis = getRedis();
        await redis.set(
          `pwd_reset:${lookupKey}`,
          JSON.stringify({ hash: otpHash, otp, channel, isStaff }),
          "EX",
          600
        );
      } catch {
        // Redis optional in local dev
      }
    }

    // 4. Send OTP code via chosen channel
    let deliveryStatus = "SENT";
    let whatsappLink: string | undefined;

    if (channel === "sms" && targetPhone) {
      try {
        await defaultProviders.smsPrimary.send({
          to: targetPhone,
          text: `NCAMart: আপনার পাসওয়ার্ড রিসেট কোড হলো ${otp}। মেয়াদ ১০ মিনিট। কোডটি কাউকে শেয়ার করবেন না।`,
        });
      } catch {
        deliveryStatus = "SIMULATED";
      }
    } else if (channel === "whatsapp" && targetPhone) {
      const cleanPhoneDigits = targetPhone.replace(/[^0-9]/g, "");
      const waText = encodeURIComponent(
        `[NCAMart Security] আপনার পাসওয়ার্ড রিসেট ভেরিফিকেশন কোড: ${otp}। এটি ১০ মিনিট কার্যকর থাকবে।`
      );
      whatsappLink = `https://wa.me/${cleanPhoneDigits}?text=${waText}`;

      try {
        await defaultProviders.whatsapp.send({
          to: targetPhone,
          templateName: "otp_verification_bn",
          language: "bn",
          bodyParams: [otp, "10 মিনিট"],
        });
      } catch {
        deliveryStatus = "WHATSAPP_LINK_READY";
      }
    } else if (channel === "email" && targetEmail) {
      try {
        await defaultProviders.email.send({
          to: targetEmail,
          subject: "NCAMart Password Reset Verification Code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
              <h2 style="color: #151515; margin-bottom: 8px;">NCAMart Password Reset</h2>
              <p style="color: #4b5563; font-size: 14px;">Hello ${userName},</p>
              <p style="color: #4b5563; font-size: 14px;">You requested to reset your password. Use the verification code below:</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #16a34a; background: #f0fdf4; padding: 12px 24px; border-radius: 8px; border: 1px dashed #86efac;">
                  ${otp}
                </span>
              </div>
              <p style="color: #6b7280; font-size: 12px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
          `,
        });
      } catch {
        deliveryStatus = "SIMULATED";
      }
    }

    // Mask destination for security
    let masked = "";
    if (channel === "email" && targetEmail) {
      const parts = targetEmail.split("@");
      const namePart = parts[0];
      masked = `${namePart.slice(0, 2)}***@${parts[1]}`;
    } else if (targetPhone) {
      masked = `${targetPhone.slice(0, 6)}****${targetPhone.slice(-3)}`;
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent via ${channel.toUpperCase()}`,
      channel,
      destination: masked,
      whatsappLink,
      deliveryStatus,
      demoOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  }
);
