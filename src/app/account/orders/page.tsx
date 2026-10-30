"use client";

import React, { useState, useEffect } from "react";
import { OrderListView } from "@/components/orders/OrderListView";
import type { CustomerOrder } from "@/components/orders/types";

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchRealOrders() {
      try {
        const res = await fetch("/api/v1/orders?limit=50");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && Array.isArray(data.items)) {
            // Map real backend order items to CustomerOrder interface
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mappedOrders: CustomerOrder[] = data.items.map((o: any) => ({
              orderNumber: o.order_number,
              createdAt: o.placed_at || new Date().toISOString(),
              status: o.status,
              paymentMethod: o.order_type === "PRE_ORDER" ? "SSLCOMMERZ" : "COD",
              paymentStatus: o.payment_status === "PAID" ? "PAID" : "PENDING_COD",
              totalPaisa: o.total_payable_paisa || 0,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              items: (o.items_preview || []).map((it: any, idx: number) => ({
                id: `item_${idx}`,
                titleEn: it.title_en || "Nawabpur Hardware Item",
                titleBn: it.title_en || "নবাবপুর হার্ডওয়্যার পণ্য",
                brandName: "Genuine NCA",
                sku: `SKU-${idx + 1}`,
                quantity: it.qty || 1,
                unitPricePaisa: it.unit_price_paisa || 0,
                totalPaisa: (it.unit_price_paisa || 0) * (it.qty || 1),
                tier: it.tier || "AUTHENTIC",
              })),
              shippingAddress: {
                consigneeName: "Customer Consignee",
                contactPhone: "+880",
                streetAddress: "Direct Courier Delivery",
                thana: "Dhaka",
                district: "Dhaka",
              },
              milestones: [
                {
                  stage: 1,
                  label: "Order Placed",
                  sublabel: "Confirmed in DB",
                  isCompleted: true,
                  isCurrent: o.status === "CONFIRMED",
                },
                {
                  stage: 2,
                  label: "Sourced & QC Tested",
                  sublabel: "Nawabpur Hub",
                  isCompleted: o.status === "QC_PASSED" || o.status === "PACKED" || o.status === "WITH_COURIER" || o.status === "DELIVERED",
                  isCurrent: o.status === "QC_PASSED" || o.status === "PACKED",
                },
                {
                  stage: 3,
                  label: "Courier Dispatch",
                  sublabel: "In Transit",
                  isCompleted: o.status === "WITH_COURIER" || o.status === "DELIVERED",
                  isCurrent: o.status === "WITH_COURIER",
                },
                {
                  stage: 4,
                  label: "Delivered",
                  sublabel: "Customer Handover",
                  isCompleted: o.status === "DELIVERED",
                  isCurrent: false,
                },
              ],
              invoicePdfUrl: `/api/v1/orders/${o.order_number}/invoice`,
            }));

            setOrders(mappedOrders);
          }
        }
      } catch {
        // Safe fallback to empty list
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchRealOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📦</div>
        <p>Loading your orders from database...</p>
      </div>
    );
  }

  return <OrderListView initialOrders={orders} />;
}
