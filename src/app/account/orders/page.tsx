import React from "react";
import type { Metadata } from "next";
import { OrderListView } from "@/components/orders/OrderListView";
import type { CustomerOrder } from "@/components/orders/types";

export const metadata: Metadata = {
  title: "My Orders & Deliveries | NCAMart",
  description: "Review current and past orders, live dispatch milestones, courier consignments, and VAT invoices.",
};

const mockOrders: CustomerOrder[] = [
  {
    orderNumber: "NCA-2026-84920",
    createdAt: "2026-10-27T10:15:00.000Z",
    status: "WITH_COURIER",
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
    courier: {
      partner: "STEADFAST",
      consignmentId: "ST-8492-DH-99",
      hotline: "09678-045045",
      riderName: "Md. Sakib Al Hasan",
      riderPhone: "+880 1912-001122",
    },
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
        isCurrent: false,
        location: "Shop 42, Nawabpur Complex",
      },
      {
        stage: 3,
        label: "QC Tested & Sealed",
        sublabel: "Hologram NCA-9X4K",
        timestamp: "2026-10-27T12:45:00.000Z",
        isCompleted: true,
        isCurrent: false,
        location: "Central Godown Bench #03",
      },
      {
        stage: 4,
        label: "Handed to Courier",
        sublabel: "Steadfast Hub",
        timestamp: "2026-10-27T14:00:00.000Z",
        isCompleted: true,
        isCurrent: true,
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
    invoicePdfUrl: "/api/v1/orders/NCA-2026-84920/invoice",
  },
  {
    orderNumber: "NCA-2026-77142",
    createdAt: "2026-10-20T14:20:00.000Z",
    status: "DELIVERED",
    paymentMethod: "COD",
    paymentStatus: "PAID",
    totalPaisa: 320000, // ৳3,200.00
    shippingAddress: {
      consigneeName: "Engr. Tanvir Ahmed",
      contactPhone: "+880 1712-345678",
      streetAddress: "House #14, Road #5, Flat 4B, Dhanmondi R/A",
      thana: "Dhanmondi",
      district: "Dhaka",
    },
    items: [
      {
        id: "item_03",
        titleEn: "Mechanic T12-X Intelligent Digital Soldering Station",
        titleBn: "মেকানিক টি১২ ইন্টেলিজেন্ট ডিজিটাল শোল্ডারিং স্টেশন",
        brandName: "Mechanic",
        sku: "MEC-T12X-PRO",
        quantity: 1,
        unitPricePaisa: 320000,
        totalPaisa: 320000,
        tier: "AUTHENTIC",
      },
    ],
    milestones: [
      { stage: 1, label: "Order Confirmed", sublabel: "Online", isCompleted: true, isCurrent: false },
      { stage: 2, label: "Sourced by Runner", sublabel: "Nawabpur", isCompleted: true, isCurrent: false },
      { stage: 3, label: "QC Tested & Sealed", sublabel: "Passed", isCompleted: true, isCurrent: false },
      { stage: 4, label: "Handed to Courier", sublabel: "Pathao", isCompleted: true, isCurrent: false },
      { stage: 5, label: "Out for Delivery", sublabel: "Dhanmondi", isCompleted: true, isCurrent: false },
      { stage: 6, label: "Delivered", sublabel: "20 Oct 2026", isCompleted: true, isCurrent: false },
    ],
    invoicePdfUrl: "/api/v1/orders/NCA-2026-77142/invoice",
  },
];

export default function CustomerOrdersPage() {
  return <OrderListView initialOrders={mockOrders} />;
}
