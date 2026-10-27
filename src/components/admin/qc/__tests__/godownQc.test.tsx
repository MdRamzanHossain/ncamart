import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { GodownQcView } from "../GodownQcView";
import { ThermalSealPrinter } from "../ThermalSealPrinter";
import { SealVoidModal } from "../SealVoidModal";
import { ToastProvider } from "@/components/ui/toast";
import type { QcInspectionItem } from "../types";

const MOCK_QC_ITEM: QcInspectionItem = {
  id: "QC-TEST-01",
  orderNumber: "NCA-2026-84920",
  skuTitle: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
  skuCode: "ANK-735-65W",
  tier: "AUTHENTIC",
  quantity: 1,
  stallName: "Al-Madina Electronics Stall",
  marketName: "Taher Tower Electrical Market",
  runnerName: "Shakil Mollah",
  voucherMemoNumber: "MEMO-ALM-8492",
  status: "PENDING_INSPECTION",
  checklist: {
    housing: true,
    cableIntegrity: true,
    voltageWattage: true,
    packaging: true,
  },
};

describe("F34: Godown QC Station & Thermal Seal Printing Console", () => {
  it("renders GodownQcView with voucher search, intake queue, active test bench, and 4-point checklist", () => {
    const html = renderToString(
      <ToastProvider>
        <GodownQcView />
      </ToastProvider>
    );

    expect(html).toContain("godown-qc-view");
    expect(html).toContain("QC Inspection &amp; Holographic Seal Station");
    expect(html).toContain("qc-voucher-search-input");

    // Intake Queue
    expect(html).toContain("qc-intake-queue-list");
    expect(html).toContain("Anker 735 GaNPrime 65W Fast Charger");
    expect(html).toContain("MEMO-ALM-8492");

    // 4-Point Checklist
    expect(html).toContain("qc-checklist-card");
    expect(html).toContain("1. Physical Housing &amp; Enclosure Integrity");
    expect(html).toContain("2. Port Pins &amp; Connector Fit Tolerance");
    expect(html).toContain("3. Voltage / Wattage Dynamic Load Testing");
    expect(html).toContain("4. Retail Packaging &amp; Barcode Intactness");

    // Action buttons
    expect(html).toContain("Reject &amp; Return to Stall");
    expect(html).toContain("Pass QC &amp; Print Holographic Seal");
    expect(html).toContain("Void Damaged Seal");
  });

  it("renders ThermalSealPrinter with 50x25mm holographic adhesive label, Base32 ID, and QR verification", () => {
    const html = renderToString(
      <ToastProvider>
        <ThermalSealPrinter
          isOpen={true}
          item={MOCK_QC_ITEM}
          sealId="NCA-8X2M-9P4K"
          serialNumber="SN-2026-84920-ANK"
          onClose={() => {}}
          onPrintComplete={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain("thermal-seal-printer-modal");
    expect(html).toContain("Destructive Holographic Seal Printer");
    expect(html).toContain("thermal-seal-label");
    expect(html).toContain("NCA-8X2M-9P4K");
    expect(html).toContain("ANK-735-65W");
    expect(html).toContain("SN-2026-84920-ANK");
    expect(html).toContain("TAMPER EVIDENT · DESTRUCTIVE VOID FOIL");
    expect(html).toContain("Print 50x25mm Label &amp; Apply Seal");
  });

  it("renders SealVoidModal with mandatory void reason dropdown and audit warning", () => {
    const html = renderToString(
      <ToastProvider>
        <SealVoidModal
          isOpen={true}
          activeSealId="NCA-8X2M-9P4K"
          onClose={() => {}}
          onVoidConfirmed={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain("seal-void-modal");
    expect(html).toContain("Void Damaged Holographic Seal");
    expect(html).toContain("NCA-8X2M-9P4K");
    expect(html).toContain("PRINTER_JAM");
    expect(html).toContain("RIBBON_TEAR");
    expect(html).toContain("STICKER_DAMAGED");
    expect(html).toContain("MISPRINTED_BARCODE");
    expect(html).toContain("Invalidate &amp; Record Void in Audit Log");
  });

  it("does not render ThermalSealPrinter when isOpen is false", () => {
    const html = renderToString(
      <ToastProvider>
        <ThermalSealPrinter
          isOpen={false}
          item={MOCK_QC_ITEM}
          sealId="NCA-8X2M-9P4K"
          serialNumber="SN-2026-84920-ANK"
          onClose={() => {}}
          onPrintComplete={() => {}}
        />
      </ToastProvider>
    );

    expect(html).not.toContain("thermal-seal-printer-modal");
  });
});
