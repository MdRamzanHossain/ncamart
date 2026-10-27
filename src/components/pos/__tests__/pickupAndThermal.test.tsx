import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ThermalReceiptPreview } from "../ThermalReceiptPreview";
import { PickupPinModal } from "../PickupPinModal";
import { ToastProvider } from "@/components/ui/toast";
import type { PosSaleReceipt } from "../types";

const MOCK_RECEIPT: PosSaleReceipt = {
  invoiceNumber: "POS-849201",
  mushak63Serial: "M6.3-2026-849201",
  timestamp: "02:45:10 PM",
  cashierName: "Rashid Alam",
  counterName: "Showroom Counter #1",
  customer: {
    phone: "+880 1711-223344",
    name: "Engr. Tanvir Ahmed",
    isGuest: false,
  },
  items: [
    {
      product: {
        id: "prod_01",
        skuId: "sku_anker_65w_blk",
        skuCode: "ANK-735-65W",
        barcode: "8901001",
        title: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
        category: "Fast Chargers",
        pricePaisa: 485000,
        showroomStock: 14,
        tier: "AUTHENTIC",
        image: "/images/anker.jpg",
      },
      quantity: 1,
      assignedSealId: "NCA-9X4K-2M7B",
    },
  ],
  subtotalPaisa: 485000,
  vatPaisa: 33950,
  totalPaisa: 485000,
  tenderedPaisa: 500000,
  changeDuePaisa: 15000,
  paymentMethod: "CASH",
  sealIds: ["NCA-9X4K-2M7B"],
};

describe("F28: Showroom Pickup PIN Verification & Thermal Receipt Preview", () => {
  it("renders ThermalReceiptPreview with 80mm ESC/POS layout and Mushak 6.3 header", () => {
    const html = renderToString(
      <ToastProvider>
        <ThermalReceiptPreview receipt={MOCK_RECEIPT} onClose={() => {}} />
      </ToastProvider>
    );

    // 80mm Toolbar & Mushak Header
    expect(html).toContain("80mm ESC/POS Thermal Paper");
    expect(html).toContain("Official Mushak 6.3 Tax Invoice");
    expect(html).toContain("NAWABPUR COMPLEX ACCESSORIES");
    expect(html).toContain("MUSHAK 6.3 VAT TAX INVOICE");
    expect(html).toContain("BIN: 002391029-0101");
    expect(html).toContain("M6.3-2026-849201");

    // Metadata
    expect(html).toContain("POS-849201");
    expect(html).toContain("Showroom Counter #1");
    expect(html).toContain("Rashid Alam");
    expect(html).toContain("Engr. Tanvir Ahmed");

    // Itemized table & BDT values
    expect(html).toContain("Anker 735 GaNPrime 65W Fast Charger");
    expect(html).toContain("ANK-735-65W");
    expect(html).toContain("৳4,850.00");

    // Financial totals & Cash tendered
    expect(html).toContain("CASH TENDER");
    expect(html).toContain("৳5,000.00");
    expect(html).toContain("৳150.00");

    // Tamper-Evident Holographic Seal QR
    expect(html).toContain("TAMPER-EVIDENT HOLOGRAPHIC SEAL");
    expect(html).toContain("NCA-9X4K-2M7B");
    expect(html).toContain("ncamart.com/verify");
  });

  it("renders PickupPinModal with 6-digit input fields and quick simulation chips", () => {
    const html = renderToString(
      <ToastProvider>
        <PickupPinModal
          isOpen={true}
          onClose={() => {}}
          onHandoverComplete={() => {}}
        />
      </ToastProvider>
    );

    // Dialog title & PRD compliance
    expect(html).toContain("Verify 6-Digit Customer Pickup PIN");
    expect(html).toContain("PRD §3.10 PIN Security Guard");
    expect(html).toContain("Nawabpur Showroom Pickup");

    // 6-digit boxes
    expect(html).toContain('data-testid="pin-digit-0"');
    expect(html).toContain('data-testid="pin-digit-5"');

    // Quick Simulation chip
    expect(html).toContain("Auto-Fill 482910 (Engr. Tanvir)");
  });

  it("does not render PickupPinModal when isOpen is false", () => {
    const html = renderToString(
      <ToastProvider>
        <PickupPinModal
          isOpen={false}
          onClose={() => {}}
          onHandoverComplete={() => {}}
        />
      </ToastProvider>
    );

    expect(html).not.toContain("pickup-modal-backdrop");
    expect(html).not.toContain("Verify 6-Digit Customer Pickup PIN");
  });
});
