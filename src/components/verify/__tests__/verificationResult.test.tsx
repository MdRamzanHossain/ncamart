import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  SealVerificationResultView,
  type SealVerificationData,
} from "../SealVerificationResultView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/verify/NCA-9X4K-2M7B",
  useSearchParams: () => new URLSearchParams(),
}));

const mockGenuineData: SealVerificationData = {
  isValid: true,
  sealId: "NCA-9X4K-2M7B",
  status: "VERIFIED",
  product: {
    titleEn: "Anker Prime 67W GaN Wall Charger (3 Ports)",
    titleBn: "অ্যাঙ্কার প্রাইম ৬৭ ওয়াট জিএএন ওয়াল চার্জার",
    brandName: "Anker",
    model: "A2669",
    imageUrl: "https://cdn.ncamart.com/products/front.webp",
    productTier: "AUTHENTIC",
  },
  serialNumber: "ANK-2026-GAN-9941",
  batchCode: "LOT-2026-OCT-A8",
  qcInspector: {
    code: "TECH-0482",
    name: "Md. Rafiqul Islam",
    verifiedAt: "2026-10-24T14:32:00.000Z",
    location: "Central Godown, Nawabpur Complex, Dhaka",
    benchNumber: "Bench #03",
    checklistPassed: [
      "3-Point Voltage & Resistance Load Test Passed",
      "Crockford Destructive Holographic Seal Applied Without Air Bubbles",
      "Factory Serial Cross-Checked with Importer Manifest",
      "Anti-Tamper Void Layer Verified Unpeeled",
    ],
  },
  warranty: {
    status: "ACTIVE",
    warrantyDaysTotal: 540,
    startsAt: "2026-10-24T14:32:00.000Z",
    expiresAt: new Date(Date.now() + 540 * 24 * 60 * 60 * 1000).toISOString(),
    coverageType: "Official Distributor 18-Month Replacement Warranty",
  },
  packagingProof: {
    durationSec: 10,
    recordedAt: "2026-10-24T14:31:45.000Z",
    inspectorNote: "Package intact, seal adhered securely, bench test completed.",
  },
  lookupCount: 1,
};

const mockVoidData: SealVerificationData = {
  isValid: false,
  sealId: "NCA-VOID-7721",
  status: "VOID",
  voidReason:
    "Damaged in transit — Outer tamper-evident void pattern triggered during courier handling.",
  message: "This seal is invalid (voided print error or tampered parcel).",
  product: {
    titleEn: "Anker Prime 67W GaN Wall Charger",
    titleBn: "অ্যাঙ্কার প্রাইম ৬৭ ওয়াট চার্জার",
    brandName: "Anker",
    productTier: "AUTHENTIC",
  },
};

const mockNotFoundData: SealVerificationData = {
  isValid: false,
  sealId: "NCA-0000-0000",
  status: "NOT_FOUND",
  message: "Invalid Seal ID. Check label or enter without spaces.",
};

describe("Seal Verification Result & Anti-Counterfeit Safeguard — F21 Tests", () => {
  it("renders genuine state with holographic stamp and authentic badges", () => {
    const html = renderToString(<SealVerificationResultView initialData={mockGenuineData} />);

    expect(html).toContain('data-testid="verified-stamp"');
    expect(html).toContain("100% GENUINE");
    expect(html).toContain("VERIFIED AUTHENTIC");
    expect(html).toContain("Official Distributor Grade");
    expect(html).toContain("NCA-9X4K-2M7B");
  });

  it("renders product specifications, manufacturer serial, and batch code", () => {
    const html = renderToString(<SealVerificationResultView initialData={mockGenuineData} />);

    expect(html).toContain("Anker Prime 67W GaN Wall Charger");
    expect(html).toContain("ANK-2026-GAN-9941");
    expect(html).toContain("LOT-2026-OCT-A8");
    expect(html).toMatch(/Model:.*A2669/);
  });

  it("renders QC inspector information and inspection checklist", () => {
    const html = renderToString(<SealVerificationResultView initialData={mockGenuineData} />);

    expect(html).toContain("Md. Rafiqul Islam");
    expect(html).toContain("TECH-0482");
    expect(html).toContain("Bench #03");
    expect(html).toContain("3-Point Voltage &amp; Resistance Load Test Passed");
  });

  it("renders distributor warranty coverage with countdown box", () => {
    const html = renderToString(<SealVerificationResultView initialData={mockGenuineData} />);

    expect(html).toContain('data-testid="warranty-countdown"');
    expect(html).toContain("Official Distributor 18-Month Replacement Warranty");
    expect(html).toContain("Initiate Warranty Claim");
  });

  it("renders 10-second packaging proof video viewport and camera HUD", () => {
    const html = renderToString(<SealVerificationResultView initialData={mockGenuineData} />);

    expect(html).toContain('data-testid="video-player"');
    expect(html).toContain("REC 4K 60FPS");
    expect(html).toContain("CAM-03 [NAWABPUR_GODOWN_QC]");
    expect(html).toContain("Play 10s QC Inspection Clip");
  });

  it("renders voided / tampered state with red warning stamp and reason", () => {
    const html = renderToString(<SealVerificationResultView initialData={mockVoidData} />);

    expect(html).toContain('data-testid="void-stamp"');
    expect(html).toContain("VOIDED / TAMPERED");
    expect(html).toContain("DO NOT ACCEPT PARCEL");
    expect(html).toContain("Damaged in transit");
    expect(html).toContain("Report Fraud / Contact WhatsApp Support");
  });

  it("renders not found state with troubleshooting instructions", () => {
    const html = renderToString(<SealVerificationResultView initialData={mockNotFoundData} />);

    expect(html).toContain("Seal ID Not Found");
    expect(html).toContain("NCA-0000-0000");
    expect(html).toContain("Troubleshooting Common Mistakes");
  });

  it("preserves genuine specifications under anti-clone safeguard (PRD §3.2.3)", () => {
    const clonedSealData: SealVerificationData = {
      ...mockGenuineData,
      lookupCount: 42,
    };
    const html = renderToString(<SealVerificationResultView initialData={clonedSealData} />);

    expect(html).not.toContain("CLONE DETECTED WARNING");
    expect(html).toContain('data-testid="verified-stamp"');
    expect(html).toContain("Anker Prime 67W GaN Wall Charger");
  });
});
