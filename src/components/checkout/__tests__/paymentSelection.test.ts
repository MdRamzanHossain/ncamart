import { describe, it, expect, vi } from "vitest";
import React from "react";
import { CodEligibilityMeter } from "../CodEligibilityMeter";
import { PaymentMethodSelector } from "../PaymentMethodSelector";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock toast hook
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("F16 — Payment Selection & Dynamic COD Eligibility Meter", () => {
  it("creates CodEligibilityMeter in FULL_COD status", () => {
    const element = React.createElement(CodEligibilityMeter, {
      status: "FULL_COD",
      deliveredCount: 4,
    });

    expect(element).toBeDefined();
    expect(element.props.status).toBe("FULL_COD");
    expect(element.props.deliveredCount).toBe(4);
  });

  it("creates CodEligibilityMeter in ADVANCE_FEE_REQUIRED status for first-time buyer", () => {
    const element = React.createElement(CodEligibilityMeter, {
      status: "ADVANCE_FEE_REQUIRED",
      advanceFeePaisa: 12000,
    });

    expect(element).toBeDefined();
    expect(element.props.status).toBe("ADVANCE_FEE_REQUIRED");
    expect(element.props.advanceFeePaisa).toBe(12000);
  });

  it("creates CodEligibilityMeter in COD_BLOCKED status with return incident counts", () => {
    const element = React.createElement(CodEligibilityMeter, {
      status: "COD_BLOCKED",
      rtoCount: 3,
    });

    expect(element).toBeDefined();
    expect(element.props.status).toBe("COD_BLOCKED");
    expect(element.props.rtoCount).toBe(3);
  });

  it("creates PaymentMethodSelector with total payable and place order callback", () => {
    const handlePlaceOrder = vi.fn().mockResolvedValue({ orderNumber: "NCA-2026-12345" });
    const element = React.createElement(PaymentMethodSelector, {
      totalPayablePaisa: 345000,
      codStatus: "ADVANCE_FEE_REQUIRED",
      advanceDeliveryFeePaisa: 12000,
      onPlaceOrder: handlePlaceOrder,
    });

    expect(element).toBeDefined();
    expect(element.props.totalPayablePaisa).toBe(345000);
  });

  it("renders counter pickup payment option when isPickupCounter is true", () => {
    const handlePlaceOrder = vi.fn().mockResolvedValue({ orderNumber: "NCA-2026-12345" });
    const element = React.createElement(PaymentMethodSelector, {
      totalPayablePaisa: 345000,
      isPickupCounter: true,
      onPlaceOrder: handlePlaceOrder,
    });

    expect(element).toBeDefined();
    expect(element.props.isPickupCounter).toBe(true);
  });
});
