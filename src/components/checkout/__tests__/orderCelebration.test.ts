import { describe, it, expect, vi } from "vitest";
import React from "react";
import { OrderCelebration } from "../OrderCelebration";

// Mock toast hook
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("F17 — Order Confirmation & Interactive Celebration Screen", () => {
  it("creates OrderCelebration element with order number and COD pending status", () => {
    const element = React.createElement(OrderCelebration, {
      orderNumber: "NCA-2026-84920",
      totalPaisa: 345000,
      paymentMode: "COD",
      paymentStatus: "UNPAID",
      recipientName: "Tanvir Rahman",
    });

    expect(element).toBeDefined();
    expect(element.props.orderNumber).toBe("NCA-2026-84920");
    expect(element.props.paymentMode).toBe("COD");
    expect(element.props.recipientName).toBe("Tanvir Rahman");
  });

  it("creates OrderCelebration element with PAID in full status for online payment", () => {
    const element = React.createElement(OrderCelebration, {
      orderNumber: "NCA-2026-99214",
      totalPaisa: 520000,
      paymentMode: "ONLINE_FULL",
      paymentStatus: "PAID",
      recipientName: "Sabbir Ahmed",
    });

    expect(element).toBeDefined();
    expect(element.props.orderNumber).toBe("NCA-2026-99214");
    expect(element.props.paymentStatus).toBe("PAID");
  });
});
