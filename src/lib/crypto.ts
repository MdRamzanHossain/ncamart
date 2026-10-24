import crypto from "node:crypto";
import { env } from "./env";
import { ValidationError } from "./errors";

/** Generate cryptographically secure random token (base64url encoded) */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Compute SHA-256 hex digest */
export function sha256Hex(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** Compute HMAC-SHA256 hex digest using secret key / pepper */
export function hmacSha256(data: string, pepper: string): string {
  return crypto.createHmac("sha256", pepper).update(data).digest("hex");
}

/**
 * Compare two strings in constant time to prevent timing attacks.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * AES-256-GCM authenticated encryption.
 * Output format: "v1:iv:tag:ciphertext" (all components hex encoded).
 */
export function aesGcmEncrypt(plaintext: string, keyHex?: string): string {
  const key = Buffer.from(keyHex || env.APP_ENCRYPTION_KEY, "hex");
  if (key.length !== 32) {
    throw new ValidationError("AES-256 key must be exactly 32 bytes (64 hex characters)");
  }

  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * AES-256-GCM authenticated decryption.
 * Accepts "v1:iv:tag:ciphertext".
 */
export function aesGcmDecrypt(versionedCiphertext: string, keyHex?: string): string {
  const parts = versionedCiphertext.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new ValidationError("Invalid ciphertext format. Expected 'v1:iv:tag:ciphertext'");
  }

  const [, ivHex, tagHex, dataHex] = parts as [string, string, string, string];
  const key = Buffer.from(keyHex || env.APP_ENCRYPTION_KEY, "hex");
  if (key.length !== 32) {
    throw new ValidationError("AES-256 key must be exactly 32 bytes (64 hex characters)");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new ValidationError("Decryption failed: integrity check or key mismatch", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}
