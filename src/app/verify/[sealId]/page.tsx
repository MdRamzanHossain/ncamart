import React from "react";
import type { Metadata } from "next";
import {
  SealVerificationResultView,
  type SealVerificationData,
} from "@/components/verify/SealVerificationResultView";
import { normalizeSealInput } from "@/modules/trust/crockford";

interface PageProps {
  params: Promise<{ sealId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sealId } = await params;
  const decodedId = decodeURIComponent(sealId).toUpperCase();

  return {
    title: `Holographic Seal Verification: ${decodedId} | NCAMart Nawabpur`,
    description: `Inspect authenticity, 10-second packaging proof video, and official distributor warranty for seal ${decodedId}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SealResultPage({ params }: PageProps) {
  const { sealId } = await params;
  const rawId = decodeURIComponent(sealId);
  const normalized = normalizeSealInput(rawId);

  // Determine verification data
  let data: SealVerificationData;

  const isVoidDemo =
    rawId.toUpperCase().includes("VOID") ||
    rawId.toUpperCase() === "NCA-VOID-7721";

  if (isVoidDemo) {
    data = {
      isValid: false,
      sealId: rawId.toUpperCase(),
      status: "VOID",
      voidReason:
        "Damaged in transit — Outer tamper-evident void pattern triggered during courier handling. Voided and recorded in Godown Incident Log.",
      message: "This seal is invalid (voided print error or tampered parcel).",
      product: {
        titleEn: "Anker Prime 67W GaN Wall Charger (3 Ports)",
        titleBn: "অ্যাঙ্কার প্রাইম ৬৭ ওয়াট জিএএন ওয়াল চার্জার",
        brandName: "Anker",
        model: "A2669",
        productTier: "AUTHENTIC",
      },
    };
  } else if (normalized || rawId.toUpperCase().startsWith("NCA-") || rawId.toUpperCase().startsWith("NC-")) {
    const formattedId = normalized || rawId.toUpperCase();
    data = {
      isValid: true,
      sealId: formattedId,
      status: "VERIFIED",
      product: {
        titleEn: "Anker Prime 67W GaN Wall Charger (3 Ports)",
        titleBn: "অ্যাঙ্কার প্রাইম ৬৭ ওয়াট জিএএন ওয়াল চার্জার",
        brandName: "Anker",
        model: "A2669",
        imageUrl: "https://cdn.ncamart.com/products/front.webp",
        productTier: "AUTHENTIC",
      },
      serialNumber: "ANK-2026-GAN-9941",
      batchCode: "LOT-2026-OCT-A8",
      qcInspector: {
        code: "TECH-0482",
        name: "Md. Rafiqul Islam",
        verifiedAt: "2026-10-24T14:32:00.000Z",
        location: "Central Godown, Nawabpur Complex, Dhaka",
        benchNumber: "Bench #03",
        checklistPassed: [
          "3-Point Voltage & Resistance Load Test Passed (67.4W Peak)",
          "Crockford Destructive Holographic Seal Applied Without Air Bubbles",
          "Factory Serial Cross-Checked with Official Importer Manifest",
          "Anti-Tamper Void Pattern Layer Verified Unpeeled",
        ],
      },
      warranty: {
        status: "ACTIVE",
        warrantyDaysTotal: 540,
        startsAt: "2026-10-24T14:32:00.000Z",
        expiresAt: new Date(Date.now() + 540 * 24 * 60 * 60 * 1000).toISOString(),
        coverageType: "Official Distributor 18-Month Replacement Warranty",
      },
      packagingProof: {
        durationSec: 10,
        recordedAt: "2026-10-24T14:31:45.000Z",
        inspectorNote: "Package intact, seal adhered securely, bench test completed.",
      },
      lookupCount: 1,
    };
  } else {
    data = {
      isValid: false,
      sealId: rawId,
      status: "NOT_FOUND",
      message: "Invalid Seal ID. Check label or enter without spaces.",
    };
  }

  return <SealVerificationResultView initialData={data} />;
}
