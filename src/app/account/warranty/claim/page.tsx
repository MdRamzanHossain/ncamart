import React from "react";
import type { Metadata } from "next";
import { RmaClaimWizard } from "@/components/rma/RmaClaimWizard";

export const metadata: Metadata = {
  title: "File RMA Warranty Claim | NCAMart",
  description: "Submit defect report with unboxing video proof for rapid 72-hour Dhaka doorstep swap or instant store credit refund.",
};

interface ClaimPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function WarrantyClaimPage({ searchParams }: ClaimPageProps) {
  const query = searchParams ? await searchParams : {};
  const sealId = typeof query.sealId === "string" ? query.sealId : "NCA-9X4K-2M7B";
  const orderNumber = typeof query.orderNumber === "string" ? query.orderNumber : "NCA-2026-84920";

  return <RmaClaimWizard sealId={sealId} orderNumber={orderNumber} />;
}
