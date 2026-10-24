import { describe, it, expect } from "vitest";
import { isValidBdPhone, normalizeBdPhone, maskPhone } from "../phone";
import { BusinessError } from "../errors";

describe("phone.ts unit tests", () => {
  it("validates valid Bangladeshi mobile numbers (Grameenphone, Banglalink, Robi, Teletalk)", () => {
    expect(isValidBdPhone("01712345678")).toBe(true);
    expect(isValidBdPhone("+8801912345678")).toBe(true);
    expect(isValidBdPhone("01812345678")).toBe(true);
    expect(isValidBdPhone("01512345678")).toBe(true);
    expect(isValidBdPhone("01312345678")).toBe(true);
    expect(isValidBdPhone("01412345678")).toBe(true);
    expect(isValidBdPhone("01612345678")).toBe(true);
  });

  it("normalizes numbers to standard +8801XXXXXXXXX", () => {
    expect(normalizeBdPhone("01712345678")).toBe("+8801712345678");
    expect(normalizeBdPhone("+8801712345678")).toBe("+8801712345678");
    expect(normalizeBdPhone(" 01712-345678 ")).toBe("+8801712345678");
  });

  it("masks phone numbers properly (017****5678)", () => {
    expect(maskPhone("01712345678")).toBe("017****5678");
    expect(maskPhone("+8801987654321")).toBe("019****4321");
  });

  it("rejects invalid phone numbers with ERR_INVALID_PHONE", () => {
    expect(isValidBdPhone("01212345678")).toBe(false); // 012 is invalid operator prefix
    expect(isValidBdPhone("0171234567")).toBe(false); // too short
    expect(isValidBdPhone("017123456789")).toBe(false); // too long
    expect(isValidBdPhone("invalid")).toBe(false);

    expect(() => normalizeBdPhone("01212345678")).toThrow(BusinessError);
  });
});
