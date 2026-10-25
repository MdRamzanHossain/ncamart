import crypto from "node:crypto";

/**
 * Standard SHA-256 hex digest generator.
 */
export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value.trim()).digest("hex");
}

/**
 * Meta Conversions API (CAPI) normalizer and hasher for email addresses.
 * Specification: Lowercase, remove whitespace, compute SHA-256 hex.
 */
export function hashEmailForMeta(email: string | undefined | null): string | undefined {
  if (!email || typeof email !== "string") return undefined;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  return sha256Hex(normalized);
}

/**
 * Meta Conversions API (CAPI) normalizer and hasher for phone numbers.
 * Specification: Remove all non-digits, remove leading '+' or leading zeroes,
 * ensure international country code (e.g. BD '880...'), compute SHA-256 hex.
 */
export function hashPhoneForMeta(phone: string | undefined | null): string | undefined {
  if (!phone || typeof phone !== "string") return undefined;
  // 1. Remove non-numeric characters
  let digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;

  // 2. Normalize Bangladesh phone numbers (e.g. 01712345678 -> 8801712345678)
  if (digits.startsWith("880")) {
    // Already has BD country code
  } else if (digits.startsWith("0")) {
    // Leading zero without country code (local BD format)
    digits = "88" + digits;
  } else if (digits.length === 10 && digits.startsWith("1")) {
    // 1712345678 without 0
    digits = "880" + digits;
  }

  return sha256Hex(digits);
}

/**
 * Normalizer and hasher for generic text fields (name, city, country).
 */
export function hashTextForMeta(text: string | undefined | null): string | undefined {
  if (!text || typeof text !== "string") return undefined;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return undefined;
  return sha256Hex(normalized);
}
