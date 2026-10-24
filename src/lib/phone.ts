/** Bangladeshi MSISDN validation and normalization (PRD §3.5). */
import { BusinessError } from "./errors";

export const BD_PHONE_REGEX = /^(?:\+8801|01)[3-9]\d{8}$/;

export function isValidBdPhone(raw: string): boolean {
  return BD_PHONE_REGEX.test(raw.trim());
}

/** Returns +8801XXXXXXXXX or throws ERR_INVALID_PHONE. Spaces and dashes are stripped first. */
export function normalizeBdPhone(raw: string): string {
  const cleaned = raw.trim().replace(/[\s-]/g, "");
  if (!BD_PHONE_REGEX.test(cleaned)) {
    throw new BusinessError("ERR_INVALID_PHONE", "Invalid Bangladeshi mobile number");
  }
  return cleaned.startsWith("+880") ? cleaned : `+88${cleaned}`;
}

/** "+8801712345678" → "017****5678". */
export function maskPhone(phone: string): string {
  const local = normalizeBdPhone(phone).slice(3); // 01XXXXXXXXX
  return `${local.slice(0, 3)}****${local.slice(-4)}`;
}
