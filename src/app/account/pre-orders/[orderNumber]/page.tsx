import React from "react";
import { Metadata } from "next";
import { PreOrderBalanceView, PreOrderBalanceData } from "@/components/preorder";

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Order #${orderNumber} Pre-Order Balance Due | NCAMart Godown Arrival`,
    description: `Settle your pre-order remaining balance for Order #${orderNumber} before the 7-day forfeiture window expires.`,
  };
}

export default async function PreOrderAccountBalancePage({ params }: PageProps) {
  const { orderNumber } = await params;

  // Mock order arrival data matching PRD §3.4 specifications
  const initialOrderData: PreOrderBalanceData = {
    orderNumber,
    itemTitle: "AIFEN A9 Pro 120W Precision Smart Soldering Station (Dual Handle)",
    brandName: "AIFEN",
    skuCode: "ENG-AIF-A9PRO",
    sealId: "NC-7X8M-92PQ",
    qcPassedAt: "Oct 27, 2026, 16:30 BST",
    totalPricePaisa: 1450000, // ৳14,500
    depositPaidPaisa: 217500, // ৳2,175 (15% deposit)
    balanceDuePaisa: 1232500, // ৳12,325 remaining balance
    orderStatus: "ARRIVED_GODOWN",
    customerName: "Mohammad Tanvir Rahman",
    customerPhone: "+8801712345678",
    showroomPin: "PIN-8492",
    isCodEligible: true,
    storeCreditBalancePaisa: 100000, // ৳1,000 store credit
  };

  return <PreOrderBalanceView initialOrderData={initialOrderData} />;
}
