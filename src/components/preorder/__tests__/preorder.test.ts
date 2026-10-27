import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  calculateDepositBreakdown,
  calculateQuotaProgress,
  PreOrderQuotaBar,
  DepositCalculator,
  PreOrderCard,
  PreOrderPolicyBanner,
  MOCK_PREORDERS,
} from "../index";

describe("Pre-Order Clearance Engine — F18 Unit Tests", () => {
  describe("Deposit Calculations (Integer Paisa Precision)", () => {
    it("correctly calculates 15% deposit on ৳14,500 item (PRD §3.4 requirement)", () => {
      // ৳14,500 = 1,450,000 paisa
      const totalPricePaisa = 1450000;
      const breakdown = calculateDepositBreakdown(totalPricePaisa, 15);

      expect(breakdown.depositPaisa).toBe(217500); // ৳2,175
      expect(breakdown.remainingPaisa).toBe(1232500); // ৳12,325
      expect(breakdown.depositPaisa + breakdown.remainingPaisa).toBe(totalPricePaisa);
      expect(breakdown.formattedTotal).toBe("৳14,500");
      expect(breakdown.formattedDeposit).toBe("৳2,175");
      expect(breakdown.formattedRemaining).toBe("৳12,325");
    });

    it("correctly calculates 20% deposit on high-ticket ৳68,000 thermal camera", () => {
      // ৳68,000 = 6,800,000 paisa
      const totalPricePaisa = 6800000;
      const breakdown = calculateDepositBreakdown(totalPricePaisa, 20);

      expect(breakdown.depositPaisa).toBe(1360000); // ৳13,600
      expect(breakdown.remainingPaisa).toBe(5440000); // ৳54,400
      expect(breakdown.depositPaisa + breakdown.remainingPaisa).toBe(totalPricePaisa);
      expect(breakdown.formattedDeposit).toBe("৳13,600");
      expect(breakdown.formattedRemaining).toBe("৳54,400");
    });

    it("correctly calculates 10% deposit on standard ৳19,500 GaN charging station", () => {
      // ৳19,500 = 1,950,000 paisa
      const totalPricePaisa = 1950000;
      const breakdown = calculateDepositBreakdown(totalPricePaisa, 10);

      expect(breakdown.depositPaisa).toBe(195000); // ৳1,950
      expect(breakdown.remainingPaisa).toBe(1755000); // ৳17,550
      expect(breakdown.depositPaisa + breakdown.remainingPaisa).toBe(totalPricePaisa);
    });
  });

  describe("Target Quota Progress Calculations", () => {
    it("calculates 80% progress for 8 of 10 units reserved (PRD milestone threshold)", () => {
      const progress = calculateQuotaProgress(8, 10);
      expect(progress.percentage).toBe(80);
      expect(progress.isFilled).toBe(false);
      expect(progress.remaining).toBe(2);
    });

    it("marks isFilled as true when reserved meets or exceeds target", () => {
      const exact = calculateQuotaProgress(10, 10);
      expect(exact.percentage).toBe(100);
      expect(exact.isFilled).toBe(true);
      expect(exact.remaining).toBe(0);

      const over = calculateQuotaProgress(12, 10);
      expect(over.percentage).toBe(100);
      expect(over.isFilled).toBe(true);
      expect(over.remaining).toBe(0);
    });

    it("handles zero target safely without division by zero error", () => {
      const zero = calculateQuotaProgress(0, 0);
      expect(zero.percentage).toBe(0);
      expect(zero.isFilled).toBe(false);
      expect(zero.remaining).toBe(0);
    });
  });

  describe("UI Components Server-Side Rendering", () => {
    it("renders PreOrderQuotaBar with reserved count and batch tag", () => {
      const html = renderToString(
        React.createElement(PreOrderQuotaBar, {
          reserved: 8,
          target: 10,
          batchCode: "AF-DH-2026-B08",
        })
      );

      expect(html).toMatch(/8.*of.*10.*units/);
      expect(html).toContain("AF-DH-2026-B08");
      expect(html).toContain("Only");
      expect(html).toContain("left!");
    });

    it("renders DepositCalculator with total, advance deposit, and balance labels", () => {
      const html = renderToString(
        React.createElement(DepositCalculator, {
          totalPricePaisa: 1450000,
          defaultDepositPercent: 15,
        })
      );

      expect(html).toContain("Progressive Deposit Calculator");
      expect(html).toContain("৳14,500");
      expect(html).toContain("৳2,175");
      expect(html).toContain("৳12,325");
      expect(html).toContain("Advance Deposit to Reserve");
    });

    it("renders PreOrderCard with progressive deposit badge and arrival date", () => {
      const testItem = MOCK_PREORDERS[0];
      const html = renderToString(
        React.createElement(PreOrderCard, {
          item: testItem,
        })
      );

      expect(html).toMatch(/15.*% Advance Deposit/);
      expect(html).toContain(testItem.estimated_arrival_window);
      expect(html).toContain("FNIRSI DSO-TC3");
      expect(html).toContain("Reserve Unit with");
    });

    it("renders PreOrderPolicyBanner with 100% Refund SLA Guarantee", () => {
      const html = renderToString(React.createElement(PreOrderPolicyBanner));

      expect(html).toContain("100% Refund SLA Guarantee");
      expect(html).toContain("Deposit forfeiture terms apply");
    });
  });
});
