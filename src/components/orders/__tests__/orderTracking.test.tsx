import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ToastProvider } from "@/components/ui/toast";
import {
  OrderListView,
  OrderTrackerView,
  formatPaisaToBDT,
  type CustomerOrder,
} from "../index";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/account/orders/NCA-2026-84920",
  useSearchParams: () => new URLSearchParams(),
}));

const mockOrderInTransit: CustomerOrder = {
  orderNumber: "NCA-2026-84920",
  createdAt: "2026-10-27T10:15:00.000Z",
  status: "WITH_COURIER",
  paymentMethod: "SSLCOMMERZ",
  paymentStatus: "PAID",
  totalPaisa: 685000,
  shippingAddress: {
    consigneeName: "Engr. Tanvir Ahmed",
    contactPhone: "+880 1712-345678",
    streetAddress: "House #14, Road #5, Dhanmondi R/A",
    thana: "Dhanmondi",
    district: "Dhaka",
  },
  courier: {
    partner: "STEADFAST",
    consignmentId: "ST-8492-DH-99",
    hotline: "09678-045045",
    riderName: "Md. Sakib Al Hasan",
    riderPhone: "+880 1912-001122",
  },
  items: [
    {
      id: "item_01",
      titleEn: "Anker Prime 67W GaN Wall Charger (3 Ports)",
      titleBn: "অ্যাঙ্কার প্রাইম ৬৭ ওয়াট জিএএন ওয়াল চার্জার",
      brandName: "Anker",
      sku: "ANK-67W-GAN-BLK",
      quantity: 1,
      unitPricePaisa: 485000,
      totalPaisa: 485000,
      tier: "AUTHENTIC",
    },
  ],
  milestones: [
    { stage: 1, label: "Order Confirmed", sublabel: "Online", isCompleted: true, isCurrent: false },
    { stage: 2, label: "Sourced by Runner", sublabel: "Nawabpur", isCompleted: true, isCurrent: false },
    { stage: 3, label: "QC Tested & Sealed", sublabel: "Passed", isCompleted: true, isCurrent: false },
    { stage: 4, label: "Handed to Courier", sublabel: "Steadfast", isCompleted: true, isCurrent: true },
    { stage: 5, label: "Out for Delivery", sublabel: "Rider En Route", isCompleted: false, isCurrent: false },
    { stage: 6, label: "Delivered", sublabel: "Customer Handover", isCompleted: false, isCurrent: false },
  ],
  invoicePdfUrl: "/api/v1/orders/NCA-2026-84920/invoice",
};

const mockOrderStockout: CustomerOrder = {
  ...mockOrderInTransit,
  orderNumber: "NCA-STOCKOUT-01",
  status: "SOURCING",
  partialStockout: {
    affectedItemTitle: "100W PD 5A E-Marker Braided Silicone Type-C Cable",
    affectedItemId: "item_02",
    stallNote: "Primary importer stall out of black 1.8m variant.",
    occurredAt: "2026-10-27T11:45:00.000Z",
  },
};

const mockOrderPickup: CustomerOrder = {
  ...mockOrderInTransit,
  orderNumber: "NCA-PICKUP-PIN",
  status: "QC_PASSED",
  courier: undefined,
  pickupPin: {
    pin: "749-218",
    qrCodeUrl: "https://ncamart.com/pos/pickup?pin=749218",
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    showroomLocation: "Shop 42, Nawabpur Complex, Sundarban Square Market, Dhaka",
  },
};

describe("Real-Time Order History & Live Delivery Tracker — F23 Tests", () => {
  describe("OrderListView Component", () => {
    it("renders order list with summary cards and filter tabs", () => {
      const html = renderToString(<OrderListView initialOrders={[mockOrderInTransit]} />);

      expect(html).toContain("My Orders &amp; Deliveries");
      expect(html).toContain("NCA-2026-84920");
      expect(html).toContain("In Transit with Courier");
      expect(html).toMatch(/6,850\.00/);
      expect(html).toContain("All Orders");
      expect(html).toContain("In Progress");
      expect(html).toContain("With Courier");
      expect(html).toContain("Track Order in Real-Time");
    });
  });

  describe("OrderTrackerView Component", () => {
    it("renders 6-stage interactive progress rail with active and completed milestones", () => {
      const html = renderToString(
        <ToastProvider>
          <OrderTrackerView initialOrder={mockOrderInTransit} />
        </ToastProvider>
      );

      expect(html).toContain('data-testid="progress-rail"');
      expect(html).toContain("Order Confirmed");
      expect(html).toContain("Sourced by Runner");
      expect(html).toContain("QC Tested &amp; Sealed");
      expect(html).toContain("Handed to Courier");
      expect(html).toContain("Out for Delivery");
      expect(html).toContain("Delivered");
    });

    it("renders courier partner and consignment details", () => {
      const html = renderToString(
        <ToastProvider>
          <OrderTrackerView initialOrder={mockOrderInTransit} />
        </ToastProvider>
      );

      expect(html).toContain('data-testid="courier-details-card"');
      expect(html).toMatch(/STEADFAST.*EXPRESS/);
      expect(html).toContain("ST-8492-DH-99");
      expect(html).toContain("09678-045045");
      expect(html).toContain("Md. Sakib Al Hasan");
    });

    it("enforces in-transit cancellation lock with explanatory tooltip (PRD §3.12, EC-03)", () => {
      const html = renderToString(
        <ToastProvider>
          <OrderTrackerView initialOrder={mockOrderInTransit} />
        </ToastProvider>
      );

      // Button should be disabled with lock tooltip
      expect(html).toContain("Cancellation Locked");
      expect(html).toContain('data-testid="cancellation-lock-tooltip"');
      expect(html).toContain("Parcel has already been dispatched with courier rider");
    });

    it("renders partial stockout decision alert and options (PRD §3.11, EC-04)", () => {
      const html = renderToString(
        <ToastProvider>
          <OrderTrackerView initialOrder={mockOrderStockout} />
        </ToastProvider>
      );

      expect(html).toContain('data-testid="partial-stockout-banner"');
      expect(html).toContain("Wholesale Stall Stockout Alert");
      expect(html).toContain("100W PD 5A E-Marker Braided Silicone Type-C Cable");
      expect(html).toContain("Primary importer stall out of black 1.8m variant");
      expect(html).toContain("Resolve Sourcing Choice");
      expect(html).toContain("Option A: Split &amp; Ship Available Items Immediately");
      expect(html).toContain("Option B: Wait 24 Hours for Alternate Wholesale Sourcing");
      expect(html).toContain("Option C: Cancel Out-of-Stock Item &amp; Receive Store Credit");
    });

    it("renders showroom pickup PIN button and counter location when showroom selected", () => {
      const html = renderToString(
        <ToastProvider>
          <OrderTrackerView initialOrder={mockOrderPickup} />
        </ToastProvider>
      );

      expect(html).toContain('data-testid="view-pickup-pin-button"');
      expect(html).toContain("View Showroom Pickup PIN");
      expect(html).toContain("Nawabpur Showroom Collection");
      expect(html).toContain("Shop 42, Nawabpur Complex");
    });
  });
});
