import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { VoucherCameraModal } from "../VoucherCameraModal";
import { GodownHandoverModal } from "../GodownHandoverModal";
import { ToastProvider } from "@/components/ui/toast";
import type { RunnerTask, RunnerProfile } from "../types";

const MOCK_RUNNER: RunnerProfile = {
  id: "RUNNER-04",
  name: "Shakil Mollah",
  phone: "+880 1722-998877",
  role: "FIELD_RUNNER",
  shiftStatus: "ON_SHIFT",
  cashFloatPaisa: 1500000,
  activeTasksCount: 2,
};

const MOCK_PURCHASED_TASKS: RunnerTask[] = [
  {
    id: "TASK-84918-01",
    orderNumber: "NCA-2026-84918",
    marketName: "Nawabpur Road Hardware Lane",
    stallName: "Haji Cables & Accessories",
    stallNumber: "Lane 3, Shop #22",
    stallContactPhone: "01911-224466",
    skuTitle: "Baseus Tungsten Gold 240W Type-C Braided Cable (2m)",
    skuCode: "BAS-240W-CBL",
    quantity: 3,
    image: "/images/cable.jpg",
    targetWholesalePricePaisa: 85000,
    maxAllowedSpotPricePaisa: 95000,
    negotiatedSpotPricePaisa: 85000,
    status: "PURCHASED",
    assignedAt: "09:45 AM",
  },
];

describe("F30: Runner Camera Voucher Scanner & Float Balance Reconciler", () => {
  it("renders VoucherCameraModal with viewfinder reticle, manual memo input, and image capture fallback", () => {
    const html = renderToString(
      <ToastProvider>
        <VoucherCameraModal
          isOpen={true}
          taskId={MOCK_PURCHASED_TASKS[0].id}
          stallName={MOCK_PURCHASED_TASKS[0].stallName}
          onClose={() => {}}
          onVoucherCaptured={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain("voucher-camera-modal");
    expect(html).toContain("Wholesale Memo Receipt Scanner");
    expect(html).toContain("Haji Cables &amp; Accessories");
    expect(html).toContain("Take Photo / Choose from Gallery");
  });

  it("does not render VoucherCameraModal when isOpen is false", () => {
    const html = renderToString(
      <ToastProvider>
        <VoucherCameraModal
          isOpen={false}
          taskId={MOCK_PURCHASED_TASKS[0].id}
          stallName={MOCK_PURCHASED_TASKS[0].stallName}
          onClose={() => {}}
          onVoucherCaptured={() => {}}
        />
      </ToastProvider>
    );

    expect(html).not.toContain("voucher-camera-modal");
  });

  it("renders GodownHandoverModal with batch QR code, float reconciler, and intake sign-off", () => {
    const html = renderToString(
      <ToastProvider>
        <GodownHandoverModal
          isOpen={true}
          runner={MOCK_RUNNER}
          purchasedTasks={MOCK_PURCHASED_TASKS}
          onClose={() => {}}
          onHandoverConfirmed={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain("godown-handover-modal");
    expect(html).toContain("Physical Batch Handover &amp; Float Sign-off");
    expect(html).toContain("Nawabpur Central Godown Intake");
    expect(html).toContain("Present this handover QR code to Godown QC Inspector");
    expect(html).toContain("Haji Cables &amp; Accessories");
    expect(html).toContain("reconciliation-summary");
    expect(html).toContain("Total Spot Cash Spent");
    expect(html).toContain("Complete Godown Intake &amp; Release Tasks");
  });

  it("does not render GodownHandoverModal when isOpen is false", () => {
    const html = renderToString(
      <ToastProvider>
        <GodownHandoverModal
          isOpen={false}
          runner={MOCK_RUNNER}
          purchasedTasks={MOCK_PURCHASED_TASKS}
          onClose={() => {}}
          onHandoverConfirmed={() => {}}
        />
      </ToastProvider>
    );

    expect(html).not.toContain("godown-handover-modal");
  });
});
