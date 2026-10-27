import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ToastProvider } from "@/components/ui/toast";
import { LocaleProvider } from "@/context/LocaleContext";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/context/AuthContext";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/verify",
}));

// Journey 1 components
import { ProductCard, type CatalogProduct } from "@/components/catalog/ProductCard";
import { CodEligibilityMeter } from "@/components/checkout/CodEligibilityMeter";
import { OrderCelebration } from "@/components/checkout/OrderCelebration";

// Journey 2 components
import { VerifyPortalView } from "@/components/verify/VerifyPortalView";
import { SealVerificationResultView, type SealVerificationData } from "@/components/verify/SealVerificationResultView";

// Journey 3 components
import { ShowroomPosView } from "@/components/pos/ShowroomPosView";
import { ThermalReceiptPreview } from "@/components/pos/ThermalReceiptPreview";
import { PickupPinModal } from "@/components/pos/PickupPinModal";

// Journey 4 components
import { RunnerTaskDashboard } from "@/components/runner/RunnerTaskDashboard";
import { VoucherCameraModal } from "@/components/runner/VoucherCameraModal";
import { GodownHandoverModal } from "@/components/runner/GodownHandoverModal";

describe("F38: End-to-End Critical User Journey Smoke Tests", () => {
  describe("Journey 1: Customer Storefront Search -> PDP -> Dual-Tier -> Checkout -> Confirmation", () => {
    it("renders dual-tier authentic product card, dynamic COD eligibility, and order celebration with Mushak 6.3", () => {
      // 1. Dual-Tier Authentic Product Card
      const mockProduct: CatalogProduct = {
        id: "PROD-ANK-735",
        slug: "anker-735-ganprime-65w",
        title_en: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
        title_bn: "অ্যাঙ্কার ৭৩৫ গ্যানপ্রাইম ৬৫ ওয়াট ফাস্ট চার্জার",
        product_tier: "AUTHENTIC",
        min_sale_price_paisa: 585000,
        min_regular_price_paisa: 650000,
        rating: 4.9,
        reviews_count: 38,
        availability: "IN_STOCK",
        primary_image_url: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600",
      };

      const cardHtml = renderToString(
        <ToastProvider>
          <LocaleProvider defaultLocale="en">
            <ProductCard product={mockProduct} />
          </LocaleProvider>
        </ToastProvider>
      );

      expect(cardHtml).toContain("Anker 735 GaNPrime 65W Fast Charger");
      expect(cardHtml).toContain("100% Authentic");
      expect(cardHtml).toContain("৳5,850.00");

      // 2. Dynamic COD Eligibility Meter (PRD §3.12)
      const codHtml = renderToString(
        <ToastProvider>
          <CodEligibilityMeter
            status="ADVANCE_FEE_REQUIRED"
            advanceFeePaisa={12000}
            deliveredCount={0}
            rtoCount={0}
          />
        </ToastProvider>
      );

      expect(codHtml).toContain("First-Time Buyer COD Policy");
      expect(codHtml).toContain("৳120.00");
      expect(codHtml).toContain("Nawabpur Fraud-Prevention Standard");

      // 3. Order Celebration & Confirmation (PRD §3.13)
      const celebrationHtml = renderToString(
        <ToastProvider>
          <LocaleProvider defaultLocale="en">
            <OrderCelebration
              orderNumber="NCA-2026-84920"
              totalPaisa={585000}
              paymentMode="ONLINE_FULL"
              paymentStatus="PAID"
              recipientPhone="01711000001"
              shippingAddress="House 12, Road 4, Dhanmondi, Dhaka"
            />
          </LocaleProvider>
        </ToastProvider>
      );

      expect(celebrationHtml).toContain("Order Successfully Confirmed!");
      expect(celebrationHtml).toContain("NCA-2026-84920");
      expect(celebrationHtml).toContain("PAID IN FULL");
      expect(celebrationHtml).toContain("Mushak 6.3");
      expect(celebrationHtml).toContain("Track Order in Real-Time");
    });
  });

  describe("Journey 2: Anti-Counterfeit Holographic Seal Verification (/verify)", () => {
    it("renders public Crockford Base32 input portal and authentic verification result with inspection video", () => {
      // 1. Public Portal
      const portalHtml = renderToString(
        <ThemeProvider defaultTheme="dark">
          <AuthProvider>
            <ToastProvider>
              <LocaleProvider defaultLocale="en">
                <VerifyPortalView />
              </LocaleProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      );

      expect(portalHtml).toContain("Holographic Seal &amp; Serial Verification");
      expect(portalHtml).toContain("seal-id-input");
      expect(portalHtml).toContain("Scan QR Code on Holographic Seal");

      // 2. Verification Result View (Genuine Authentic State)
      const mockGenuineResult: SealVerificationData = {
        isValid: true,
        sealId: "NCA-9K2M-4P81",
        status: "VERIFIED",
        product: {
          titleEn: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
          titleBn: "অ্যাঙ্কার ৭৩৫ গ্যানপ্রাইম ৬৫ ওয়াট ফাস্ট চার্জার",
          brandName: "Anker",
          productTier: "AUTHENTIC",
          imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600",
        },
        serialNumber: "SN-ANK-2026-00412",
        batchCode: "BATCH-2026-Q3",
        qcInspector: {
          code: "QC-KH-01",
          name: "Khorshed Alam",
          verifiedAt: "2026-10-26 14:30:00",
          location: "Nawabpur Central Godown Hub",
          benchNumber: "Test Bench #1",
          checklistPassed: ["Physical Housing", "Port Pins", "Voltage/Wattage Load", "Packaging"],
        },
        warranty: {
          status: "ACTIVE",
          warrantyDaysTotal: 546,
          startsAt: "2026-10-26",
          expiresAt: "2028-04-26",
          coverageType: "18-Month Official Importer Replacement",
        },
        packagingProof: {
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          durationSec: 10,
          recordedAt: "2026-10-26 14:32:00",
          inspectorNote: "Tested 65W PD load; all 3 ports verified with holographic seal attached.",
        },
        lookupCount: 1,
      };

      const resultHtml = renderToString(
        <ToastProvider>
          <LocaleProvider defaultLocale="en">
            <SealVerificationResultView initialData={mockGenuineResult} />
          </LocaleProvider>
        </ToastProvider>
      );

      expect(resultHtml).toContain("100% GENUINE");
      expect(resultHtml).toContain("VERIFIED AUTHENTIC");
      expect(resultHtml).toContain("NCA-9K2M-4P81");
      expect(resultHtml).toContain("SN-ANK-2026-00412");
      expect(resultHtml).toContain("Khorshed Alam");
      expect(resultHtml).toContain("10-Second Godown QC Inspection Clip");
    });
  });

  describe("Journey 3: Showroom POS Counter Touch Sale -> Pickup PIN -> Thermal Receipt", () => {
    it("renders touch POS billing console, pickup PIN signature modal, and 80mm ESC/POS thermal receipt", () => {
      // 1. Touch POS Billing Console
      const posHtml = renderToString(
        <ToastProvider>
          <LocaleProvider defaultLocale="en">
            <ShowroomPosView />
          </LocaleProvider>
        </ToastProvider>
      );

      expect(posHtml).toContain("showroom-pos-view");
      expect(posHtml).toContain("NCAMart POS");
      expect(posHtml).toContain("SHOWROOM_AGENT");
      expect(posHtml).toContain("pos-pickup-trigger-btn");
      expect(posHtml).toContain("Laser Barcode Gun Active");

      // 2. Showroom Pickup PIN Verification & Handover Signoff Modal
      const pickupHtml = renderToString(
        <ToastProvider>
          <PickupPinModal
            isOpen={true}
            onClose={() => {}}
            onHandoverComplete={() => {}}
          />
        </ToastProvider>
      );

      expect(pickupHtml).toContain("pickup-pin-modal");
      expect(pickupHtml).toContain("Nawabpur Showroom Pickup");
      expect(pickupHtml).toContain("Verify 6-Digit Customer Pickup PIN");
      expect(pickupHtml).toContain("pin-digit-box");

      // 3. 80mm ESC/POS Thermal Receipt Modal
      const mockReceipt: PosSaleReceipt = {
        invoiceNumber: "NCA-POS-2026-0081",
        mushak63Serial: "M6.3-2026-0081",
        timestamp: "2026-10-27 15:45:00",
        cashierName: "Hasan Ali (Counter #1)",
        counterName: "Showroom Counter #1",
        customer: { name: "Walk-in Guest", isGuest: true },
        items: [
          {
            product: {
              id: "pos_prod_01",
              skuId: "sku_anker_65w_blk",
              skuCode: "ANK-735-65W",
              barcode: "8901001",
              title: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
              category: "Fast Chargers",
              pricePaisa: 585000,
              showroomStock: 14,
              tier: "AUTHENTIC",
            },
            quantity: 1,
            assignedSealId: "NCA-9K2M-4P81",
          },
        ],
        subtotalPaisa: 508696,
        vatPaisa: 76304,
        totalPaisa: 585000,
        tenderedPaisa: 600000,
        changeDuePaisa: 15000,
        paymentMethod: "CASH",
        sealIds: ["NCA-9K2M-4P81"],
      };

      const receiptHtml = renderToString(
        <ThermalReceiptPreview
          receipt={mockReceipt}
          onClose={() => {}}
        />
      );

      expect(receiptHtml).toContain("thermal-preview-backdrop");
      expect(receiptHtml).toContain("80mm ESC/POS Thermal Paper");
      expect(receiptHtml).toContain("NAWABPUR COMPLEX ACCESSORIES");
      expect(receiptHtml).toContain("MUSHAK 6.3 VAT TAX INVOICE");
      expect(receiptHtml).toContain("BIN: 002391029-0101");
      expect(receiptHtml).toContain("NCA-POS-2026-0081");
      expect(receiptHtml).toContain("NCA-9K2M-4P81");
      expect(receiptHtml).toContain("thermal-print-btn");
    });
  });

  describe("Journey 4: Field-Runner Mobile PWA Sourcing -> Voucher Scan -> Godown Handover", () => {
    it("renders Runner Task Dashboard with Zero PII protocol, voucher camera scanner, and godown handover batch reconciler", () => {
      // 1. Runner Mobile PWA Task Dashboard
      const runnerHtml = renderToString(
        <ToastProvider>
          <RunnerTaskDashboard />
        </ToastProvider>
      );

      expect(runnerHtml).toContain("runner-pwa-container");
      expect(runnerHtml).toContain("Shakil Mollah");
      expect(runnerHtml).toContain("Cash in Hand");
      expect(runnerHtml).toContain("PRD §3.8 Zero Customer PII Protocol");
      expect(runnerHtml).toContain("handover-batch-btn");

      // 2. Voucher Camera Scanner Modal
      const cameraHtml = renderToString(
        <ToastProvider>
          <VoucherCameraModal
            isOpen={true}
            taskId="TASK-84918-01"
            stallName="Haji Cables &amp; Accessories"
            onClose={() => {}}
            onVoucherCaptured={() => {}}
          />
        </ToastProvider>
      );

      expect(cameraHtml).toContain("voucher-camera-modal");
      expect(cameraHtml).toContain("Haji Cables &amp; Accessories");
      expect(cameraHtml).toContain("viewfinder-box");
      expect(cameraHtml).toContain("Wholesale Memo Receipt Scanner");
      expect(cameraHtml).toContain("snap-shutter-btn");

      // 3. Central Godown Intake Batch QR & Float Balance Reconciler
      const mockRunner = {
        id: "RUNNER-04",
        name: "Shakil Mollah",
        phone: "+880 1722-998877",
        role: "FIELD_RUNNER" as const,
        shiftStatus: "ON_SHIFT" as const,
        cashFloatPaisa: 1500000,
        activeTasksCount: 1,
      };

      const mockPurchasedTasks = [
        {
          id: "TASK-84918-01",
          orderNumber: "NCA-2026-84918",
          marketName: "Nawabpur Road Hardware Lane",
          stallName: "Haji Cables & Accessories",
          stallNumber: "Lane 3, Shop #22",
          stallContactPhone: "01911-224466",
          skuTitle: "Baseus Tungsten Gold 240W Type-C Braided Cable (2m)",
          skuCode: "BAS-TC-240W",
          quantity: 3,
          image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=400&q=80",
          targetWholesalePricePaisa: 85000,
          maxAllowedSpotPricePaisa: 95000,
          negotiatedSpotPricePaisa: 85000,
          status: "PURCHASED" as const,
          assignedAt: "10:10 AM",
        },
      ];

      const handoverHtml = renderToString(
        <ToastProvider>
          <GodownHandoverModal
            isOpen={true}
            runner={mockRunner}
            purchasedTasks={mockPurchasedTasks}
            onClose={() => {}}
            onHandoverConfirmed={() => {}}
          />
        </ToastProvider>
      );

      expect(handoverHtml).toContain("godown-handover-modal");
      expect(handoverHtml).toContain("Nawabpur Central Godown Intake");
      expect(handoverHtml).toContain("Physical Batch Handover");
      expect(handoverHtml).toContain("Total Spot Cash Spent:");
      expect(handoverHtml).toContain("Remaining Float in Hand:");
      expect(handoverHtml).toContain("confirm-godown-handover-btn");
    });
  });
});
