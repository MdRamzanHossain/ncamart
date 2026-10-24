import { randomInt } from "node:crypto";

// Crockford Base32: 32 symbols, excludes I, L, O, U (architechture.md §7.1)
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SEAL_REGEX = /^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/**
 * Generate a cryptographically secure, unbiased Crockford Base32 Seal ID.
 * Format: NCA-XXXX-XXXX
 */
export function generateSealId(): string {
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += CROCKFORD_ALPHABET[randomInt(32)]; // unbiased CSPRNG
  }
  return `NCA-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * Normalize seal input string:
 * - Upper-case
 * - Strips whitespace and hyphens
 * - Maps ambiguous characters: O -> 0, I/L -> 1
 * - Handles optional leading 'NCA'
 * - Validates Crockford 8-character body
 */
export function normalizeSealInput(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  const body = cleaned.startsWith("NCA") ? cleaned.slice(3) : cleaned;
  if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(body)) return null;
  return `NCA-${body.slice(0, 4)}-${body.slice(4)}`;
}
