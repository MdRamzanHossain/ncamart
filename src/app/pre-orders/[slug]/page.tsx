import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MOCK_PREORDERS,
  calculateDepositBreakdown,
  PreOrderPDPView,
} from "@/components/preorder";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = MOCK_PREORDERS.find((p) => p.slug === slug) ?? MOCK_PREORDERS[0];

  if (!item) {
    return { title: "Pre-Order | NCAMart Air-Freight Import" };
  }

  return {
    title: `Pre-Order: ${item.title_en} | NCAMart Air-Freight Import`,
    description: `Book your ${item.brand_name} with ${item.deposit_percent}% advance deposit. Estimated arrival ${item.estimated_arrival_window}. 100% money-back SLA guarantee.`,
  };
}

export default async function PreOrderPDPPage({ params }: PageProps) {
  const { slug } = await params;
  const item =
    MOCK_PREORDERS.find((p) => p.slug === slug || slug.includes(p.brand_slug)) || MOCK_PREORDERS[0];

  if (!item) {
    notFound();
  }

  const breakdown = calculateDepositBreakdown(item.total_price_paisa, item.deposit_percent);

  return <PreOrderPDPView item={item} breakdown={breakdown} />;
}
