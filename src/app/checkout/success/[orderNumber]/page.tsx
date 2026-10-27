import React from "react";
import { StorefrontShell } from "@/components/layout";
import { OrderCelebration } from "@/components/checkout";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Order Confirmed: ${orderNumber} | NCAMart`,
    description: "Your order has been placed successfully and is queued for Nawabpur Complex godown QC inspection.",
  };
}

export default async function OrderSuccessPage({ params }: PageProps) {
  const { orderNumber } = await params;

  return (
    <StorefrontShell>
      <OrderCelebration orderNumber={orderNumber} />
    </StorefrontShell>
  );
}
