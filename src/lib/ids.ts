import crypto from "node:crypto";

/**
 * UUIDv7 Generator (RFC 9562).
 * Time-sortable UUID with millisecond timestamp precision and random bits.
 */
export function uuidv7(): string {
  const bytes = crypto.randomBytes(16);
  const now = Date.now();

  // 48-bit timestamp in milliseconds
  bytes[0] = (now >> 40) & 0xff;
  bytes[1] = (now >> 32) & 0xff;
  bytes[2] = (now >> 24) & 0xff;
  bytes[3] = (now >> 16) & 0xff;
  bytes[4] = (now >> 8) & 0xff;
  bytes[5] = now & 0xff;

  // 4-bit version (0111 = 7)
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // 2-bit variant (10xx = RFC 4122/9562)
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Crockford Base32 alphabet: 32 symbols, excludes I, L, O, U
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SEAL_REGEX = /^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/** Generate Crockford Base32 holographic seal ID: NCA-XXXX-XXXX */
export function generateSealId(): string {
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += CROCKFORD_ALPHABET[crypto.randomInt(32)];
  }
  return `NCA-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Normalize seal input string, replacing common OCR errors (O->0, I/L->1) */
export function normalizeSealInput(raw: string): string | null {
  const cleaned = raw
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  const body = cleaned.startsWith("NCA") ? cleaned.slice(3) : cleaned;
  if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(body)) {
    return null;
  }
  return `NCA-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Human-readable number generators and formatters */
export function formatOrderNumber(year: number, sequence: number): string {
  return `ORD-${year}-${String(sequence).padStart(5, "0")}`;
}

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(5, "0")}`;
}

export function formatRmaNumber(year: number, sequence: number): string {
  return `RMA-${year}-${String(sequence).padStart(4, "0")}`;
}

export function formatRunnerTaskNumber(dateKey: string, sequence: number): string {
  // dateKey is YYYYMMDD
  return `RUN-${dateKey.replace(/-/g, "")}-${String(sequence).padStart(4, "0")}`;
}

export function formatRefundNumber(year: number, sequence: number): string {
  return `REF-${year}-${String(sequence).padStart(5, "0")}`;
}

export function formatJournalNumber(dateKey: string, sequence: number): string {
  // dateKey is YYYYMMDD
  return `JRN-${dateKey.replace(/-/g, "")}-${String(sequence).padStart(5, "0")}`;
}

/** Format transaction ID: NCA-TXN-YYYYMMDD-XXXXXX */
export function formatTransactionId(dateKey: string, randomPart: string): string {
  return `NCA-TXN-${dateKey.replace(/-/g, "")}-${randomPart.toUpperCase()}`;
}

/** Generate unique transaction ID: NCA-TXN-YYYYMMDD-XXXXXX */
export function generateTransactionId(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dateKey = `${yyyy}${mm}${dd}`;
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return formatTransactionId(dateKey, randomPart);
}

export interface NumberGenerator {
  nextOrderNumber(year: number): Promise<string>;
  nextRmaNumber(year: number): Promise<string>;
  nextRunnerNumber(dateKey: string): Promise<string>;
  nextRefundNumber(year: number): Promise<string>;
  nextJournalNumber(dateKey: string): Promise<string>;
  nextMushakNumber(fiscalYear: string): Promise<string>;
}
