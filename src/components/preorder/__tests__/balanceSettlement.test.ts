import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ToastProvider } from "@/components/ui/toast";
import {
  ForfeitureCountdownBanner,
  PreOrderBalanceCard,
  BalanceSettlementModal,
  PreOrderBalanceData,
} from "../index";

const mockBalanceOrder: PreOrderBalanceData = {
  orderNumber: "NCA-PREO-2026-9041",
  itemTitle: "AIFEN A9 Pro 120W Precision Smart Soldering Station (Dual Handle)",
  brandName: "AIFEN",
  skuCode: "ENG-AIF-A9PRO",
  sealId: "NC-7X8M-92PQ",
  qcPassedAt: "Oct 27, 2026, 16:30 BST",
  totalPricePaisa: 1450000, // ৳14,500
  depositPaidPaisa: 217500, // ৳2,175
  balanceDuePaisa: 1232500, // ৳12,325
  orderStatus: "ARRIVED_GODOWN",
  customerName: "Mohammad Tanvir Rahman",
  customerPhone: "+8801712345678",
  showroomPin: "PIN-8492",
  isCodEligible: true,
  storeCreditBalancePaisa: 100000, // ৳1,000
};

describe("Customer Pre-Order Balance Settlement — F19 Unit Tests", () => {
  describe("7-Day Forfeiture Countdown Banner", () => {
    it("renders countdown banner with policy explanation", () => {
      const html = renderToString(
        React.createElement(ForfeitureCountdownBanner, {
          forfeitureDaysWindow: 7,
        })
      );

      expect(html).toContain("7-Day Balance Settlement Window Active");
      expect(html).toContain("to avoid reservation forfeiture");
      expect(html).toContain("Unclaimed units after 7 days are released to general catalog");
      expect(html).toContain("minus 10% restocking fee");
      expect(html).toContain("Days");
      expect(html).toContain("Hours");
      expect(html).toContain("Mins");
    });
  });

  describe("Pre-Order Balance Alert Card", () => {
    it("renders QC Passed status, seal link, and financial breakdown", () => {
      const html = renderToString(
        React.createElement(PreOrderBalanceCard, {
          orderData: mockBalanceOrder,
          onOpenPayModal: () => {},
        })
      );

      expect(html).toMatch(/Arrived at Nawabpur Godown.*QC Passed/);
      expect(html).toContain("NC-7X8M-92PQ");
      expect(html).toContain("ENG-AIF-A9PRO");
      expect(html).toContain("৳14,500"); // Total
      expect(html).toContain("৳2,175"); // Deposit
      expect(html).toContain("৳12,325"); // Remaining
      expect(html).toContain("Settle Balance");
    });
  });

  describe("Balance Settlement Modal & PRD §3.4.2 COD Rules", () => {
    it("enforces COD cap when balance exceeds ৳5,000 threshold", () => {
      // Balance is ৳12,325 (> ৳5,000)
      const html = renderToString(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(BalanceSettlementModal, {
            orderData: mockBalanceOrder,
            isOpen: true,
            onClose: () => {},
            onSuccess: () => {},
          })
        )
      );

      expect(html).toContain("Settle Pre-Order Arrival Balance");
      expect(html).toContain("Instant Online Payment (bKash / Nagad / Cards)");
      expect(html).toContain("Capped at ৳5,000"); // COD disabled with cap badge
      expect(html).toContain("Pay at Nawabpur Showroom Counter");
      expect(html).toContain("Apply Store Credit Balance");
    });

    it("allows COD when balance is under ৳5,000 threshold", () => {
      const underCapOrder: PreOrderBalanceData = {
        ...mockBalanceOrder,
        totalPricePaisa: 500000,
        depositPaidPaisa: 100000,
        balanceDuePaisa: 400000, // ৳4,000 <= ৳5,000
      };

      const html = renderToString(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(BalanceSettlementModal, {
            orderData: underCapOrder,
            isOpen: true,
            onClose: () => {},
            onSuccess: () => {},
          })
        )
      );

      expect(html).not.toContain("Capped at ৳5,000");
      expect(html).toContain("Pay balance in cash upon courier parcel handover");
    });
  });
});
