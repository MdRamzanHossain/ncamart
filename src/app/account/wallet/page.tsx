import React from "react";
import type { Metadata } from "next";
import { StoreCreditWalletView } from "@/components/account/StoreCreditWalletView";
import type { StoreCreditWalletData } from "@/components/account/types";

export const metadata: Metadata = {
  title: "Store Credit Wallet | NCAMart",
  description: "View store credit balance, review ledger transactions, and withdraw funds to bank or bKash.",
};

const mockWalletData: StoreCreditWalletData = {
  balancePaisa: 485000, // ৳4,850.00
  pendingWithdrawalPaisa: 0,
  transactions: [
    {
      id: "tx_01",
      amountPaisa: 285000,
      type: "REFUND_RMA",
      reference: "RMA-2026-0812",
      notes: "RMA Defect Resolution: Instant Store Credit Refund for Anker GaN Charger",
      createdAt: "2026-10-25T16:20:00.000Z",
      balanceAfterPaisa: 485000,
    },
    {
      id: "tx_02",
      amountPaisa: 200000,
      type: "PREORDER_FORFEITURE_CREDIT",
      reference: "PRE-84920",
      notes: "Pre-Order Balance Window Rebalance (10% restocking deducted per PRD §3.4)",
      createdAt: "2026-10-22T11:45:00.000Z",
      balanceAfterPaisa: 200000,
    },
    {
      id: "tx_03",
      amountPaisa: -145000,
      type: "PURCHASE_DEBIT",
      reference: "ORD-99214",
      notes: "Store credit payment applied on checkout for Mechanic Soldering Paste & Flux",
      createdAt: "2026-10-18T19:10:00.000Z",
      balanceAfterPaisa: 0,
    },
    {
      id: "tx_04",
      amountPaisa: 145000,
      type: "COMPENSATION",
      reference: "CMP-00412",
      notes: "Courier dispatch SLA goodwill credit voucher",
      createdAt: "2026-10-15T14:00:00.000Z",
      balanceAfterPaisa: 145000,
    },
  ],
};

export default function StoreCreditWalletPage() {
  return <StoreCreditWalletView initialData={mockWalletData} />;
}
