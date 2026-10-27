import React from "react";
import type { Metadata } from "next";
import { OrderTrackerView } from "@/components/orders/OrderTrackerView";
import type { CustomerOrder } from "@/components/orders/types";

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  const decodedNumber = decodeURIComponent(orderNumber).toUpperCase();

  return {
    title: `Tracking Order ${decodedNumber} | NCAMart Nawabpur`,
    description: `Track real-time rider dispatch, godown inspection, and courier handover for order ${decodedNumber}.`,
  };
}

export default async function OrderTrackerPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const rawNumber = decodeURIComponent(orderNumber).toUpperCase();

  const isStockoutDemo = rawNumber.includes("STOCKOUT");
  const isPickupDemo = rawNumber.includes("PICKUP");

  const orderData: CustomerOrder = {
    orderNumber: rawNumber,
    createdAt: "2026-10-27T10:15:00.000Z",
    status: isStockoutDemo ? "SOURCING" : isPickupDemo ? "QC_PASSED" : "WITH_COURIER",
    paymentMethod: "SSLCOMMERZ",
    paymentStatus: "PAID",
    totalPaisa: 685000, // ৳6,850.00
    shippingAddress: {
      consigneeName: "Engr. Tanvir Ahmed",
      contactPhone: "+880 1712-345678",
      streetAddress: "House #14, Road #5, Flat 4B, Dhanmondi R/A",
      thana: "Dhanmondi",
      district: "Dhaka",
    },
    courier: !isPickupDemo
      ? {
          partner: "STEADFAST",
          consignmentId: "ST-8492-DH-99",
          hotline: "09678-045045",
          riderName: "Md. Sakib Al Hasan",
          riderPhone: "+880 1912-001122",
        }
      : undefined,
    pickupPin: isPickupDemo
      ? {
          pin: "749-218",
          qrCodeUrl: "https://ncamart.com/pos/pickup?pin=749218",
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          showroomLocation: "Shop 42, Nawabpur Complex, Sundarban Square Market, Dhaka",
        }
      : undefined,
    partialStockout: isStockoutDemo
      ? {
          affectedItemTitle: "100W PD 5A E-Marker Braided Silicone Type-C Cable (1.8m)",
          affectedItemId: "item_02",
          stallNote: "Primary importer stall out of black 1.8m variant. Alternative red color available at adjacent stall.",
          occurredAt: "2026-10-27T11:45:00.000Z",
        }
      : undefined,
    items: [
      {
        id: "item_01",
        titleEn: "Anker Prime 67W GaN Wall Charger (3 Ports)",
        titleBn: "অ্যাঙ্কার প্রাইম ৬৭ ওয়াট জিএএন ওয়াল চার্জার",
        brandName: "Anker",
        sku: "ANK-67W-GAN-BLK",
        quantity: 1,
        unitPricePaisa: 485000,
        totalPaisa: 485000,
        tier: "AUTHENTIC",
        imageUrl: "https://cdn.ncamart.com/products/front.webp",
      },
      {
        id: "item_02",
        titleEn: "100W PD 5A E-Marker Braided Silicone Type-C Cable (1.8m)",
        titleBn: "১০০ ওয়াট পিডি ফাস্ট চার্জিং টাইপ-সি ক্যাবল",
        brandName: "Baseus",
        sku: "BAS-100W-TYPEC-18M",
        quantity: 2,
        unitPricePaisa: 100000,
        totalPaisa: 200000,
        tier: "BUDGET_SMART",
      },
    ],
    milestones: [
      {
        stage: 1,
        label: "Order Confirmed",
        sublabel: "Payment Verified",
        timestamp: "2026-10-27T10:15:00.000Z",
        isCompleted: true,
        isCurrent: false,
      },
      {
        stage: 2,
        label: "Sourced by Runner",
        sublabel: "Nawabpur Cluster",
        timestamp: "2026-10-27T11:30:00.000Z",
        isCompleted: true,
        isCurrent: isStockoutDemo,
        location: "Shop 42, Nawabpur Complex",
      },
      {
        stage: 3,
        label: "QC Tested & Sealed",
        sublabel: "Hologram NCA-9X4K",
        timestamp: "2026-10-27T12:45:00.000Z",
        isCompleted: !isStockoutDemo,
        isCurrent: isPickupDemo,
        location: "Central Godown Bench #03",
      },
      {
        stage: 4,
        label: "Handed to Courier",
        sublabel: "Steadfast Hub",
        timestamp: "2026-10-27T14:00:00.000Z",
        isCompleted: !isStockoutDemo && !isPickupDemo,
        isCurrent: !isStockoutDemo && !isPickupDemo,
        location: "Dhaka Central Sorting Hub",
      },
      {
        stage: 5,
        label: "Out for Delivery",
        sublabel: "Rider En Route",
        isCompleted: false,
        isCurrent: false,
      },
      {
        stage: 6,
        label: "Delivered",
        sublabel: "Customer Handover",
        isCompleted: false,
        isCurrent: false,
      },
    ],
    invoicePdfUrl: `/api/v1/orders/${rawNumber}/invoice`,
  };

  return <OrderTrackerView initialOrder={orderData} />;
}
