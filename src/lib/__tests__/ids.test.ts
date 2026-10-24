import { describe, it, expect } from "vitest";
import {
  uuidv7,
  generateSealId,
  normalizeSealInput,
  SEAL_REGEX,
  formatOrderNumber,
  formatRmaNumber,
  formatRunnerTaskNumber,
  formatRefundNumber,
  formatJournalNumber,
} from "../ids";

describe("ids.ts unit tests", () => {
  it("generates time-sortable valid UUIDv7 identifiers", async () => {
    const id1 = uuidv7();
    // sleep 2ms to ensure monotonic time tick
    await new Promise((r) => setTimeout(r, 2));
    const id2 = uuidv7();

    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(id1 < id2).toBe(true);
  });

  it("generates Crockford Base32 seal IDs conforming to SEAL_REGEX", () => {
    for (let i = 0; i < 20; i++) {
      const sealId = generateSealId();
      expect(SEAL_REGEX.test(sealId)).toBe(true);
      expect(sealId).toMatch(/^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    }
  });

  it("normalizes seal input handling OCR ambiguity (O->0, I/L->1)", () => {
    // lowercase, spaces, dashes
    expect(normalizeSealInput("nca 8f2k 9x41")).toBe("NCA-8F2K-9X41");
    // without prefix
    expect(normalizeSealInput("8F2K9X41")).toBe("NCA-8F2K-9X41");
    // letter O replaced with digit 0, I/L replaced with 1
    expect(normalizeSealInput("NCA-8FOK-IL41")).toBe("NCA-8F0K-1141");
    // invalid characters
    expect(normalizeSealInput("NCA-INVALID-SEAL")).toBeNull();
  });

  it("formats human-readable numbers with correct zero-padding", () => {
    expect(formatOrderNumber(2026, 42)).toBe("ORD-2026-00042");
    expect(formatRmaNumber(2026, 7)).toBe("RMA-2026-0007");
    expect(formatRunnerTaskNumber("20261022", 5)).toBe("RUN-20261022-0005");
    expect(formatRefundNumber(2026, 123)).toBe("REF-2026-00123");
    expect(formatJournalNumber("20261022", 99)).toBe("JRN-20261022-00099");
  });
});
