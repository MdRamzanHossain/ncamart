import { describe, it, expect } from "vitest";
import { vatFromInclusive } from "../vat";
import { assertPaisa } from "../money";

describe("vat.ts unit tests", () => {
  it("calculates 7.5% VAT (750 bp) from inclusive gross price", () => {
    // Gross: 10,750 paisa (৳107.50). With 7.5% VAT: net = 10,000, vat = 750
    const res = vatFromInclusive(assertPaisa(10750), 750);
    expect(res.vatPaisa).toBe(750);
    expect(res.netPaisa).toBe(10000);
    expect(res.netPaisa + res.vatPaisa).toBe(10750);
  });

  it("maintains netPaisa + vatPaisa === grossPaisa invariant for various amounts", () => {
    const grossAmounts = [100, 550, 1000, 12345, 99999, 1000000];
    const rateBp = 750; // 7.5% standard VAT rate

    for (const gross of grossAmounts) {
      const split = vatFromInclusive(assertPaisa(gross), rateBp);
      expect(split.netPaisa + split.vatPaisa).toBe(gross);
    }
  });

  it("handles 0% VAT rate", () => {
    const split = vatFromInclusive(assertPaisa(5000), 0);
    expect(split.vatPaisa).toBe(0);
    expect(split.netPaisa).toBe(5000);
  });

  it("rounds half-up properly", () => {
    // Gross = 100 paisa, VAT = 7.5% -> 100 * 750 / 10750 = 6.976 -> 7 paisa
    const split = vatFromInclusive(assertPaisa(100), 750);
    expect(split.vatPaisa).toBe(7);
    expect(split.netPaisa).toBe(93);
  });
});
