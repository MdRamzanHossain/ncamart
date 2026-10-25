import crypto from "node:crypto";
import { env } from "@/lib/env";

export interface OptOutPayload {
  customerId: string;
  phone: string;
  exp: number; // epoch ms
}

/**
 * Generate a signed URL token for Class C promotional opt-outs.
 */
export function createOptOutToken(
  customerId: string,
  phone: string,
  expiresInDays = 90
): string {
  const exp = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const payload: OptOutPayload = {
    customerId,
    phone,
    exp,
  };
  const jsonStr = JSON.stringify(payload);
  const dataB64 = Buffer.from(jsonStr).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(dataB64)
    .digest("base64url");
  return `${dataB64}.${signature}`;
}

/**
 * Verify signed opt-out token.
 */
export function verifyOptOutToken(
  token: string
): { valid: boolean; customerId?: string; phone?: string; error?: string } {
  if (!token || !token.includes(".")) {
    return { valid: false, error: "Malformed token" };
  }

  const [dataB64, sig] = token.split(".");
  const expectedSig = crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(dataB64)
    .digest("base64url");

  if (sig !== expectedSig) {
    return { valid: false, error: "Invalid signature" };
  }

  try {
    const jsonStr = Buffer.from(dataB64, "base64url").toString("utf8");
    const payload = JSON.parse(jsonStr) as OptOutPayload;

    if (Date.now() > payload.exp) {
      return { valid: false, error: "Token expired" };
    }

    return {
      valid: true,
      customerId: payload.customerId,
      phone: payload.phone,
    };
  } catch {
    return { valid: false, error: "Failed to parse token payload" };
  }
}

/**
 * Build opt-out URL from token.
 */
export function buildOptOutUrl(token: string): string {
  return `${env.APP_BASE_URL}/api/v1/notifications/opt-out?token=${token}`;
}

/**
 * Appends opt-out link to Class C promotional messages.
 */
export function appendOptOutNotice(
  messageText: string,
  token: string,
  locale: "bn" | "en" = "bn"
): string {
  const optOutUrl = buildOptOutUrl(token);
  if (locale === "bn") {
    return `${messageText}\n\nপ্রমোশনাল বার্তা বন্ধ করতে: ${optOutUrl}`;
  }
  return `${messageText}\n\nTo opt-out: ${optOutUrl}`;
}
