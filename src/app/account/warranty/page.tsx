import React from "react";
import type { Metadata } from "next";
import { WarrantyPortalView } from "@/components/rma/WarrantyPortalView";
import type { ActiveWarranty } from "@/components/rma/types";

export const metadata: Metadata = {
  title: "Warranties & Defect Claims | NCAMart",
  description: "View remaining official distributor warranties, inspect destructive seals, and request 72-hour Dhaka doorstep replacement swaps.",
};

const mockWarranties: ActiveWarranty[] = [
  {
    id: "war_01",
    orderNumber: "NCA-2026-84920",
    sealId: "NCA-9X4K-2M7B",
    productTitleEn: "Anker Prime 67W GaN Wall Charger (3 Ports)",
    productTitleBn: "অ্যাঙ্কার প্রাইম ৬৭ ওয়াট জিএএন ওয়াল চার্জার",
    brandName: "Anker",
    serialNumber: "ANK-2026-GAN-9941",
    deliveredAt: "2026-10-24T14:32:00.000Z",
    expiresAt: new Date(Date.now() + 540 * 24 * 3600 * 1000).toISOString(),
    warrantyDaysTotal: 540,
    coverageType: "OFFICIAL_DISTRIBUTOR_18_MONTH",
    coverageLabel: "Official Distributor 18-Month",
    imageUrl: "https://cdn.ncamart.com/products/front.webp",
    status: "ACTIVE",
  },
  {
    id: "war_02",
    orderNumber: "NCA-2026-77142",
    sealId: "NCA-MEC-4412",
    productTitleEn: "Mechanic T12-X Intelligent Digital Soldering Station",
    productTitleBn: "মেকানিক টি১২ ইন্টেলিজেন্ট ডিজিটাল শোল্ডারিং স্টেশন",
    brandName: "Mechanic",
    serialNumber: "MEC-2026-T12X-041",
    deliveredAt: "2026-10-20T14:20:00.000Z",
    expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
    warrantyDaysTotal: 180,
    coverageType: "NCAMART_6_MONTH_REPLACEMENT",
    coverageLabel: "NCAMart 6-Month Replacement",
    status: "ACTIVE",
  },
];

export default function WarrantiesPortalPage() {
  return <WarrantyPortalView initialWarranties={mockWarranties} />;
}
