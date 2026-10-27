import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  formatCrockfordInput,
  isValidCrockfordSeal,
  CrockfordInputMask,
  SealLocationGuide,
  QrScannerModal,
} from "../index";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("Public Holographic Seal Verification Portal — F20 Unit Tests", () => {
  describe("Crockford Base32 Mask & Sanitization Engine", () => {
    it("auto-formats raw lowercase input into standard NCA-XXXX-XXXX format", () => {
      const formatted = formatCrockfordInput("9x4k2m7b");
      expect(formatted).toBe("NCA-9X4K-2M7B");
      expect(isValidCrockfordSeal(formatted)).toBe(true);
    });

    it("auto-maps ambiguous characters: O -> 0, I -> 1, L -> 1", () => {
      // Input contains O, I, L
      const formatted = formatCrockfordInput("oil92m7b");
      // O -> 0, I -> 1, L -> 1: 0119-2M7B
      expect(formatted).toBe("NCA-0119-2M7B");
      expect(isValidCrockfordSeal(formatted)).toBe(true);
    });

    it("rejects invalid character U and symbols per Crockford specification", () => {
      // Input has 'U' and '@'
      const formatted = formatCrockfordInput("9x4u@2m7b");
      // U and @ stripped, leaving 9X42M7B (7 chars)
      expect(formatted).toBe("NCA-9X42-M7B");
      expect(isValidCrockfordSeal(formatted)).toBe(false); // only 7 chars
    });

    it("handles inputs that already include the 'NCA-' prefix gracefully", () => {
      const formatted = formatCrockfordInput("NCA-9X4K-2M7B");
      expect(formatted).toBe("NCA-9X4K-2M7B");
      expect(isValidCrockfordSeal(formatted)).toBe(true);
    });

    it("validates seal regex strictly", () => {
      expect(isValidCrockfordSeal("NCA-9X4K-2M7B")).toBe(true);
      expect(isValidCrockfordSeal("NCA-0000-0000")).toBe(true);
      expect(isValidCrockfordSeal("NCA-ZZZZ-ZZZZ")).toBe(true);
      expect(isValidCrockfordSeal("NCA-123")).toBe(false);
      expect(isValidCrockfordSeal("INVALID-SEAL")).toBe(false);
    });
  });

  describe("CrockfordInputMask Component SSR", () => {
    it("renders search box with Crockford mask placeholder and icon", () => {
      const html = renderToString(
        React.createElement(CrockfordInputMask, {
          initialValue: "9x4k2m7b",
        })
      );

      expect(html).toContain('placeholder="NCA-XXXX-XXXX"');
      expect(html).toContain('value="NCA-9X4K-2M7B"');
      expect(html).toContain("Verify");
    });
  });

  describe("SealLocationGuide Component SSR", () => {
    it("renders 3D seal locator steps and tamper void test tabs", () => {
      const html = renderToString(React.createElement(SealLocationGuide));

      expect(html).toContain("How to Locate &amp; Verify Your Seal");
      expect(html).toContain("Parcel Corner Seams");
      expect(html).toContain("Printed Crockford Base32 ID");
      expect(html).toContain("NCA-9X4K-2M7B");
    });
  });

  describe("QrScannerModal Component SSR", () => {
    it("renders scanner reticle, simulated QR chips, and laser scan line", () => {
      const html = renderToString(
        React.createElement(QrScannerModal, {
          isOpen: true,
          onClose: () => {},
        })
      );

      expect(html).toContain("Scan Holographic QR Seal");
      expect(html).toContain("Simulate QR Scan:");
      expect(html).toContain("Genuine Seal (NCA-9X4K-2M7B)");
      expect(html).toContain("Tampered VOID (NCA-VOID-7721)");
    });

    it("returns null when closed", () => {
      const html = renderToString(
        React.createElement(QrScannerModal, {
          isOpen: false,
          onClose: () => {},
        })
      );

      expect(html).toBe("");
    });
  });
});
