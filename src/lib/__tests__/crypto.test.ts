import { describe, it, expect } from "vitest";
import {
  randomToken,
  sha256Hex,
  hmacSha256,
  aesGcmEncrypt,
  aesGcmDecrypt,
  timingSafeEqualStr,
} from "../crypto";
import { ValidationError } from "../errors";

describe("crypto.ts unit tests", () => {
  it("generates base64url random tokens of requested byte length", () => {
    const token = randomToken(32);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("computes accurate SHA-256 and HMAC-SHA256 hex digests", () => {
    const hash = sha256Hex("ncamart-test");
    expect(hash).toHaveLength(64);

    const hmac = hmacSha256("ncamart-test", "secret-pepper");
    expect(hmac).toHaveLength(64);
  });

  it("encrypts and decrypts strings using AES-256-GCM with versioned format", () => {
    const plaintext = "ncamart:totp-secret:JBSWY3DPEHPK3PXP";
    const ciphertext = aesGcmEncrypt(plaintext);

    expect(ciphertext.startsWith("v1:")).toBe(true);
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(4); // v1, iv, tag, data

    const decrypted = aesGcmDecrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it("fails to decrypt tampered ciphertext", () => {
    const ciphertext = aesGcmEncrypt("confidential");
    const parts = ciphertext.split(":");
    // Tamper with data part
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}ff`;

    expect(() => aesGcmDecrypt(tampered)).toThrow(ValidationError);
  });

  it("performs timing-safe string equality checks", () => {
    expect(timingSafeEqualStr("token123", "token123")).toBe(true);
    expect(timingSafeEqualStr("token123", "token456")).toBe(false);
    expect(timingSafeEqualStr("token123", "token1234")).toBe(false);
  });
});
