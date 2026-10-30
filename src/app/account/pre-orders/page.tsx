"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface CustomerPreOrderSummary {
  orderNumber: string;
  itemTitle: string;
  brandName: string;
  skuCode: string;
  slug: string;
  status: "ARRIVED_GODOWN" | "IN_TRANSIT" | "COMPLETED";
  statusLabel: string;
  totalPriceBdt: string;
  depositPaidBdt: string;
  balanceDueBdt: string;
  etaOrDeadline: string;
  sealId?: string;
}

export default function CustomerPreOrdersPage() {
  const [preOrders, setPreOrders] = useState<CustomerPreOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchPreOrders() {
      try {
        const res = await fetch("/api/v1/orders?type=PRE_ORDER&limit=20");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && Array.isArray(data.items)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped: CustomerPreOrderSummary[] = data.items.map((o: any) => {
              const totalBdt = Math.round((o.total_payable_paisa || 0) / 100);
              const depositBdt = Math.round(totalBdt * 0.15);
              const balanceBdt = totalBdt - depositBdt;
              const firstItem = o.items_preview?.[0];

              return {
                orderNumber: o.order_number,
                itemTitle: firstItem?.title_en || "Pre-Order Import Component",
                brandName: "Genuine NCA Import",
                skuCode: `PO-${o.order_number.slice(-4)}`,
                slug: "pre-orders",
                status: o.status === "QC_PASSED" || o.status === "PACKED" ? "ARRIVED_GODOWN" : "IN_TRANSIT",
                statusLabel: o.status === "QC_PASSED" ? "Arrived at Godown — Balance Due" : "Import Freight & Customs Clearance",
                totalPriceBdt: `৳${totalBdt.toLocaleString("en-BD")}`,
                depositPaidBdt: `৳${depositBdt.toLocaleString("en-BD")} (15%)`,
                balanceDueBdt: `৳${balanceBdt.toLocaleString("en-BD")}`,
                etaOrDeadline: "Estimated Godown Arrival within 10-14 days",
              };
            });
            setPreOrders(mapped);
          }
        }
      } catch {
        // Safe empty fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPreOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
        <p>Loading your pre-orders and import tracking...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--color-text-primary, #f8fafc)",
            margin: "0 0 0.25rem",
          }}
        >
          My Pre-Orders &amp; Import Arrivals
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #94a3b8)", margin: 0 }}>
          Track 15% pre-order deposits, international air/sea freight milestones, Nawabpur Godown QC inspection, and
          balance settlement windows.
        </p>
      </div>

      {/* Zero Pre-Orders State */}
      {preOrders.length === 0 ? (
        <div
          style={{
            padding: "3.5rem 2rem",
            borderRadius: "16px",
            background: "var(--color-surface, #ffffff)",
            border: "1px solid var(--color-border, #e2e8f0)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem" }}>No Active Pre-Orders</h2>
          <p style={{ color: "var(--color-text-secondary, #64748b)", fontSize: "0.875rem", maxWidth: "480px", margin: "0 auto 1.5rem" }}>
            You do not have any pending international import pre-orders. When you pre-order specialized tools or industrial gear with a 15% deposit, track them live here!
          </p>
          <Link
            href="/pre-orders"
            style={{
              display: "inline-block",
              padding: "0.75rem 1.75rem",
              borderRadius: "9999px",
              backgroundColor: "var(--color-brand-primary, #0066f5)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.875rem",
              textDecoration: "none",
            }}
          >
            Explore Nawabpur Pre-Orders →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {preOrders.map((po) => {
            const isArrived = po.status === "ARRIVED_GODOWN";

            return (
              <div
                key={po.orderNumber}
                style={{
                  borderRadius: "16px",
                  padding: "1.25rem 1.5rem",
                  background: isArrived
                    ? "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)"
                    : "var(--color-surface, #ffffff)",
                  border: isArrived
                    ? "1px solid rgba(245, 158, 11, 0.4)"
                    : "1px solid var(--color-border, #e2e8f0)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: "0.8125rem",
                          fontWeight: 800,
                          color: "#f59e0b",
                        }}
                      >
                        #{po.orderNumber}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                          backgroundColor: isArrived ? "rgba(245, 158, 11, 0.18)" : "rgba(56, 189, 248, 0.15)",
                          color: isArrived ? "#fbbf24" : "#38bdf8",
                        }}
                      >
                        {po.statusLabel}
                      </span>
                    </div>

                    <h2
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 700,
                        margin: "0 0 0.25rem",
                      }}
                    >
                      {po.itemTitle}
                    </h2>

                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>
                      Brand: <strong>{po.brandName}</strong> · SKU: <code>{po.skuCode}</code>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>
                      Remaining Balance Due
                    </div>
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 900,
                        fontFamily: "var(--font-mono, monospace)",
                        color: isArrived ? "#fbbf24" : "var(--color-text-primary, #0f172a)",
                      }}
                    >
                      {po.balanceDueBdt}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                      Total: {po.totalPriceBdt} · Paid Deposit: {po.depositPaidBdt}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid var(--color-border, #e2e8f0)",
                    paddingTop: "0.75rem",
                    fontSize: "0.8125rem",
                  }}
                >
                  <span style={{ color: "#64748b" }}>{po.etaOrDeadline}</span>
                  <Link
                    href={`/account/orders/${po.orderNumber}`}
                    style={{
                      color: "var(--color-brand-primary, #0066f5)",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    View Import Timeline →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
