import { describe, it, expect } from "vitest";
import {
  toBengaliDigits,
  toEnglishDigits,
  formatLocalizedNumber,
  formatLocalizedPaisa,
  t,
} from "../i18n";

describe("F37: i18n & Bengali Numeral Formatting", () => {
  it("converts single and multi-digit Arabic numbers to Bengali digits", () => {
    expect(toBengaliDigits(0)).toBe("০");
    expect(toBengaliDigits(123456789)).toBe("১২৩৪৫৬৭৮৯");
    expect(toBengaliDigits("NCA-2026-84920")).toBe("NCA-২০২৬-৮৪৯২০");
    expect(toBengaliDigits("1,850.50")).toBe("১,৮৫০.৫০");
  });

  it("converts Bengali digits back to English Arabic digits", () => {
    expect(toEnglishDigits("০")).toBe("0");
    expect(toEnglishDigits("১২৩৪৫৬৭৮৯")).toBe("123456789");
    expect(toEnglishDigits("NCA-২০২৬-৮৪৯২০")).toBe("NCA-2026-84920");
  });

  it("formats localized numbers according to active locale", () => {
    expect(formatLocalizedNumber(142, "en")).toBe("142");
    expect(formatLocalizedNumber(142, "bn")).toBe("১৪২");
    expect(formatLocalizedNumber("SKU-99", "bn")).toBe("SKU-৯৯");
  });

  it("formats integer Paisa into localized currency strings with Bengali numerals", () => {
    // ৳1,850.00
    expect(formatLocalizedPaisa(185000, "en")).toBe("৳1,850.00");
    expect(formatLocalizedPaisa(185000, "bn")).toBe("৳১,৮৫০.০০");

    // Zero
    expect(formatLocalizedPaisa(0, "en")).toBe("৳0.00");
    expect(formatLocalizedPaisa(0, "bn")).toBe("৳০.০০");

    // Negative (Refund / Discount)
    expect(formatLocalizedPaisa(-120000, "en")).toBe("-৳1,200.00");
    expect(formatLocalizedPaisa(-120000, "bn")).toBe("-৳১,২০০.০০");
  });

  it("translates common storefront keys in both English and Bengali", () => {
    expect(t("nav.skipToContent", "en")).toBe("Skip to main content");
    expect(t("nav.skipToContent", "bn")).toBe("মূল বিষয়বস্তুতে যান");

    expect(t("trust.authentic", "en")).toBe("100% Authentic Guaranteed");
    expect(t("trust.authentic", "bn")).toBe("১০০% আসল ও খাঁটি পণ্যের নিশ্চয়তা");

    expect(t("btn.addToCart", "en")).toBe("Add to Cart");
    expect(t("btn.addToCart", "bn")).toBe("কার্টে যোগ করুন");

    // Fallback on missing key
    expect(t("unknown.custom.key", "bn")).toBe("unknown.custom.key");
  });
});
