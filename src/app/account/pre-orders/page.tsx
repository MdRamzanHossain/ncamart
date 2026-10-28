import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "My Pre-Orders & Import Arrivals | NCAMart",
  description:
    "Track 15% pre-order deposits, international air/sea freight milestones, Nawabpur Godown QC inspection, and 7-day balance settlement windows.",
};

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

const MOCK_CUSTOMER_PREORDERS: CustomerPreOrderSummary[] = [
  {
    orderNumber: "NCA-PO-2026-8812",
    itemTitle: "AIFEN A9 Pro 120W Precision Smart Soldering Station (Dual Handle)",
    brandName: "AIFEN",
    skuCode: "ENG-AIF-A9PRO",
    slug: "aifen-a9-pro-smart-soldering-station-c210-c245",
    status: "ARRIVED_GODOWN",
    statusLabel: "Arrived at Godown — Balance Due (7-Day Window)",
    totalPriceBdt: "৳14,500",
    depositPaidBdt: "৳2,175 (15%)",
    balanceDueBdt: "৳12,325",
    etaOrDeadline: "Settle by Nov 03, 2026 (23:59 BST)",
    sealId: "NC-7X8M-92PQ",
  },
  {
    orderNumber: "NCA-PO-2026-9045",
    itemTitle: "FNIRSI DSO-TC3 3-in-1 Digital Oscilloscope, Signal Generator & Transistor Tester",
    brandName: "FNIRSI",
    skuCode: "ENG-FNI-DSOTC3",
    slug: "fnirsi-dso-tc3-transistor-tester-oscilloscope",
    status: "IN_TRANSIT",
    statusLabel: "Air Freight Customs Clearance (HSIA Dhaka)",
    totalPriceBdt: "৳6,500",
    depositPaidBdt: "৳975 (15%)",
    balanceDueBdt: "৳5,525",
    etaOrDeadline: "Estimated Godown Arrival: Nov 12, 2026",
  },
];

export default function CustomerPreOrdersPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "var(--color-text-primary, #f8fafc)",
              margin: "0 0 0.25rem",
            }}
          >
            Pre-Orders & Import Arrivals
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #94a3b8)", margin: 0 }}>
            Monitor direct-importer batch shipments, Godown QC seals, and remaining balance settlements.
          </p>
        </div>

        <Link
          href="/pre-orders"
          style={{
            padding: "0.625rem 1.125rem",
            borderRadius: "0.625rem",
            backgroundColor: "var(--tier-authentic-gold, #f59e0b)",
            color: "#0b0f19",
            fontWeight: 800,
            fontSize: "0.8125rem",
            textDecoration: "none",
          }}
        >
          ✈️ Browse Active Pre-Order Batches →
        </Link>
      </div>

      {/* Pre-Order Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {MOCK_CUSTOMER_PREORDERS.map((po) => {
          const isArrived = po.status === "ARRIVED_GODOWN";
          return (
            <div
              key={po.orderNumber}
              style={{
                background: "var(--color-surface, #111827)",
                border: isArrived
                  ? "1.5px solid rgba(245, 158, 11, 0.55)"
                  : "1px solid var(--color-border, #1e293b)",
                borderRadius: "1rem",
                padding: "1.25rem 1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                boxShadow: isArrived ? "0 8px 24px rgba(245, 158, 11, 0.12)" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "0.8125rem",
                        fontWeight: 800,
                        color: "var(--tier-authentic-gold, #f59e0b)",
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
                      color: "var(--color-text-primary, #f8fafc)",
                      margin: "0 0 0.25rem",
                    }}
                  >
                    {po.itemTitle}
                  </h2>

                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #94a3b8)" }}>
                    Brand: <strong>{po.brandName}</strong> · SKU: <code>{po.skuCode}</code>
                    {po.sealId && (
                      <>
                        {" · "}QC Seal:{" "}
                        <Link
                          href={`/verify/${po.sealId}`}
                          style={{ color: "#10b981", fontWeight: 700, textDecoration: "none" }}
                        >
                          🛡️ {po.sealId}
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #94a3b8)" }}>
                    Remaining Balance Due
                  </div>
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 900,
                      fontFamily: "var(--font-mono, monospace)",
                      color: isArrived ? "#fbbf24" : "var(--color-text-primary, #f8fafc)",
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
                  paddingTop: "0.75rem",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: isArrived ? "#f59e0b" : "#94a3b8", fontWeight: 600 }}>
                  ⏳ {po.etaOrDeadline}
                </span>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Link
                    href={`/pre-orders/${po.slug}`}
                    style={{
                      padding: "0.5rem 0.875rem",
                      borderRadius: "0.5rem",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "var(--color-text-primary, #f8fafc)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Batch Spec Sheet
                  </Link>
                  <Link
                    href={`/account/pre-orders/${po.orderNumber}`}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "0.5rem",
                      backgroundColor: isArrived ? "#f59e0b" : "#2563eb",
                      color: isArrived ? "#0b0f19" : "#ffffff",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      textDecoration: "none",
                    }}
                  >
                    {isArrived ? "💳 Settle Balance & Dispatch →" : "📊 View Milestone Tracker →"}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

