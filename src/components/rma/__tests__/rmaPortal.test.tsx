import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ToastProvider } from "@/components/ui/toast";
import {
  WarrantyPortalView,
  RmaClaimWizard,
  calculateRemainingDays,
  type ActiveWarranty,
} from "../index";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/account/warranty",
  useSearchParams: () => new URLSearchParams(),
}));

const mockWarranties: ActiveWarranty[] = [
  {
    id: "war_01",
    orderNumber: "NCA-2026-84920",
    sealId: "NCA-9X4K-2M7B",
    productTitleEn: "Anker Prime 67W GaN Wall Charger (3 Ports)",
    productTitleBn: "অ্যাঙ্কার প্রাইম ৬৭ ওয়াট জিএএন ওয়াল চার্জার",
    brandName: "Anker",
    serialNumber: "ANK-2026-GAN-9941",
    deliveredAt: "2026-10-24T14:32:00.000Z",
    expiresAt: new Date(Date.now() + 540 * 24 * 3600 * 1000).toISOString(),
    warrantyDaysTotal: 540,
    coverageType: "OFFICIAL_DISTRIBUTOR_18_MONTH",
    coverageLabel: "Official Distributor 18-Month",
    imageUrl: "https://cdn.ncamart.com/products/front.webp",
    status: "ACTIVE",
  },
];

describe("Warranty Portal & Drag-and-Drop Video RMA Claim Form — F24 Tests", () => {
  it("calculates remaining warranty days accurately", () => {
    const futureDate = new Date(Date.now() + 100 * 24 * 3600 * 1000).toISOString();
    const result = calculateRemainingDays(futureDate);
    expect(result.days).toBeGreaterThanOrEqual(99);
    expect(result.isExpired).toBe(false);

    const pastDate = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
    const expiredResult = calculateRemainingDays(pastDate);
    expect(expiredResult.days).toBe(0);
    expect(expiredResult.isExpired).toBe(true);
  });

  describe("WarrantyPortalView Component", () => {
    it("renders active warranties with remaining days pill and coverage badge", () => {
      const html = renderToString(
        <ToastProvider>
          <WarrantyPortalView initialWarranties={mockWarranties} />
        </ToastProvider>
      );

      expect(html).toContain("Active Warranties &amp; Defect Claims");
      expect(html).toContain("Anker Prime 67W GaN Wall Charger");
      expect(html).toContain("Official Distributor 18-Month");
      expect(html).toContain('data-testid="remaining-days-pill"');
      expect(html).toMatch(/Days Remaining/);
      expect(html).toContain("ANK-2026-GAN-9941");
      expect(html).toContain('data-testid="claim-warranty-button"');
    });

    it("renders SLA assurance banner for rapid 72h Dhaka doorstep swap", () => {
      const html = renderToString(
        <ToastProvider>
          <WarrantyPortalView initialWarranties={mockWarranties} />
        </ToastProvider>
      );

      expect(html).toContain("NCAMart RMA Guarantee");
      expect(html).toContain("1 business hour");
      expect(html).toContain("72 hours");
    });
  });

  describe("RmaClaimWizard Component", () => {
    it("renders step 1 with defect checklist categories and description field", () => {
      const html = renderToString(
        <ToastProvider>
          <RmaClaimWizard
            sealId="NCA-9X4K-2M7B"
            orderNumber="NCA-2026-84920"
            productTitle="Anker Prime 67W GaN Charger"
          />
        </ToastProvider>
      );

      expect(html).toContain('data-testid="rma-step-1"');
      expect(html).toContain("Dead on Arrival (DOA)");
      expect(html).toContain("Abnormal Overheating");
      expect(html).toContain("Loose Port / Connector");
      expect(html).toContain("Power Delivery Failure");
      expect(html).toContain('data-testid="defect-description-input"');
      expect(html).toContain('data-testid="step-1-next-button"');
    });
  });
});
