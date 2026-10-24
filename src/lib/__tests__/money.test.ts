import { describe, it, expect } from "vitest";
import {
  assertPaisa,
  toSignedPaisa,
  takaToPaisa,
  paisaToTakaString,
  addPaisa,
  subtractPaisa,
  sumPaisa,
  roundUpToTaka,
  pctOfPaisa,
  divRound,
} from "../money";
import { ValidationError } from "../errors";

describe("money.ts unit tests", () => {
  describe("assertPaisa and takaToPaisa", () => {
    it("brands valid integers as Paisa", () => {
      const p = assertPaisa(15000);
      expect(p).toBe(15000);
    });

    it("throws on negative or non-integer amounts in assertPaisa", () => {
      expect(() => assertPaisa(-1)).toThrow(ValidationError);
      expect(() => assertPaisa(10.5)).toThrow(ValidationError);
    });

    it("allows negative in toSignedPaisa", () => {
      const p = toSignedPaisa(-500);
      expect(p).toBe(-500);
    });

    it("converts integer taka to paisa accurately", () => {
      expect(takaToPaisa(120)).toBe(12000);
      expect(takaToPaisa(0)).toBe(0);
    });

    it("converts decimal taka string to paisa accurately without float math", () => {
      expect(takaToPaisa("1200.5")).toBe(120050);
      expect(takaToPaisa("1,200.50")).toBe(120050);
      expect(takaToPaisa("0.05")).toBe(5);
      expect(takaToPaisa("99.99")).toBe(9999);
    });

    it("rejects invalid taka formats", () => {
      expect(() => takaToPaisa("12.345")).toThrow(ValidationError);
      expect(() => takaToPaisa("abc")).toThrow(ValidationError);
      expect(() => takaToPaisa(12.5)).toThrow(ValidationError);
    });
  });

  describe("paisaToTakaString formatting", () => {
    it("formats English taka strings with comma separators and fraction", () => {
      expect(paisaToTakaString(120000)).toBe("৳1,200.00");
      expect(paisaToTakaString(50)).toBe("৳0.50");
      expect(paisaToTakaString(0)).toBe("৳0.00");
    });

    it("formats Bangla numerals when locale is 'bn'", () => {
      expect(paisaToTakaString(120000, "bn")).toBe("৳১,২০০.০০");
      expect(paisaToTakaString(987654, "bn")).toBe("৳৯,৮৭৬.৫৪");
    });

    it("handles negative amounts correctly", () => {
      expect(paisaToTakaString(-12500)).toBe("-৳125.00");
      expect(paisaToTakaString(-12500, "bn")).toBe("-৳১২৫.০০");
    });
  });

  describe("math and arithmetic helpers", () => {
    it("adds, subtracts, and sums paisa safely", () => {
      const a = assertPaisa(100);
      const b = assertPaisa(250);
      expect(addPaisa(a, b)).toBe(350);
      expect(subtractPaisa(b, a)).toBe(150);
      expect(sumPaisa([assertPaisa(10), assertPaisa(20), assertPaisa(30)])).toBe(60);
    });

    it("divRound handles up, down, and half_up", () => {
      // 5 / 2 = 2.5
      expect(divRound(5n, 2n, "down")).toBe(2n);
      expect(divRound(5n, 2n, "up")).toBe(3n);
      expect(divRound(5n, 2n, "half_up")).toBe(3n);

      // 4 / 3 = 1.333
      expect(divRound(4n, 3n, "half_up")).toBe(1n);
      expect(divRound(4n, 3n, "up")).toBe(2n);
    });

    it("roundUpToTaka rounds up to exact taka multiples", () => {
      // step 1 taka = 100 paisa
      expect(roundUpToTaka(assertPaisa(105), 1)).toBe(200);
      expect(roundUpToTaka(assertPaisa(100), 1)).toBe(100);

      // step 10 taka = 1000 paisa (e.g. pre-order deposit rounding PRD §3.6.6)
      expect(roundUpToTaka(assertPaisa(1201), 10)).toBe(2000);
      expect(roundUpToTaka(assertPaisa(1000), 10)).toBe(1000);
      expect(roundUpToTaka(assertPaisa(1001), 10)).toBe(2000);
    });

    it("pctOfPaisa computes basis points percentage with rounding", () => {
      // 1000 paisa * 500 bp (5%) = 50 paisa
      expect(pctOfPaisa(assertPaisa(1000), 500)).toBe(50);

      // 1500 paisa * 750 bp (7.5%) = 112.5 paisa -> half_up: 113
      expect(pctOfPaisa(assertPaisa(1500), 750, "half_up")).toBe(113);
      expect(pctOfPaisa(assertPaisa(1500), 750, "down")).toBe(112);
      expect(pctOfPaisa(assertPaisa(1500), 750, "up")).toBe(113);
    });
  });
});
