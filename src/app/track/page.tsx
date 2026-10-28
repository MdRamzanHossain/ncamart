"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";

const SAMPLE_ORDERS = [
  {
    orderNumber: "NCA-2026-84920",
    label: "In Transit with Steadfast Courier",
    desc: "Anker 67W GaN + Baseus 100W Cable (Dhaka Hub)",
  },
  {
    orderNumber: "NCA-2026-PICKUP-42",
    label: "Showroom Counter Pickup Ready",
    desc: "Shop 42 Nawabpur Complex — 6-Digit PIN Issued",
  },
  {
    orderNumber: "NCA-2026-STOCKOUT-09",
    label: "Partial Stall Stockout Resolution",
    desc: "Runner sourcing color alternative at Nawabpur stall",
  },
];

export default function TrackConsignmentPage() {
  const router = useRouter();
  const [orderInput, setOrderInput] = useState("NCA-2026-84920");

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = orderInput.trim();
    if (!cleaned) return;
    router.push(`/account/orders/${encodeURIComponent(cleaned)}`);
  };

  return (
    <StorefrontShell>
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "var(--space-3xl) var(--space-md) var(--space-4xl)",
        }}
      >
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }}>
          <Link href="/" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
            Home
          </Link>
          {" / "}
          <span style={{ color: "var(--text-secondary)" }}>Consignment & Order Tracker</span>
        </div>

        <div
          style={{
            borderRadius: "var(--radius-xl)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            padding: "var(--space-2xl)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--tier-authentic-gold-bg)",
              color: "var(--tier-authentic-gold)",
              fontSize: "11px",
              fontWeight: "800",
              marginBottom: "var(--space-sm)",
            }}
          >
            LIVE 6-STAGE LOGISTICS TELEMETRY
          </span>

          <h1
            style={{
              fontSize: "clamp(1.6rem, 3vw, 2.25rem)",
              fontWeight: "900",
              color: "var(--text-primary)",
              margin: "0 0 var(--space-xs)",
              letterSpacing: "-0.03em",
            }}
          >
            Track Your Nawabpur Order or Courier Consignment
          </h1>

          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-xl)" }}>
            Enter your NCAMart Order Number (e.g., <code>NCA-2026-84920</code>) to view real-time runner stall sourcing,
            Godown bench QC seal minting, and Pathao / Steadfast / RedX rider telemetry.
          </p>

          <form
            onSubmit={handleTrackSubmit}
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              flexWrap: "wrap",
              marginBottom: "var(--space-2xl)",
            }}
          >
            <input
              type="text"
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              placeholder="Enter Order # (e.g. NCA-2026-84920)"
              aria-label="Order Number"
              required
              style={{
                flex: "1 1 260px",
                padding: "14px 16px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-family-mono)",
                fontSize: "var(--font-size-base)",
                fontWeight: "700",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "14px 24px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-brand-primary)",
                color: "#ffffff",
                fontWeight: "800",
                fontSize: "var(--font-size-sm)",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 14px var(--color-brand-primary-glow)",
              }}
            >
              📦 Track Live Status →
            </button>
          </form>

          {/* Sample Demo Orders */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-lg)" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "800",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-tertiary)",
                marginBottom: "var(--space-md)",
              }}
            >
              Quick Demo Consignments (Click to Inspect)
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "var(--space-md)",
              }}
            >
              {SAMPLE_ORDERS.map((sample) => (
                <Link
                  key={sample.orderNumber}
                  href={`/account/orders/${sample.orderNumber}`}
                  style={{
                    padding: "var(--space-md)",
                    borderRadius: "var(--radius-lg)",
                    backgroundColor: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-default)",
                    textDecoration: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-family-mono)",
                      fontWeight: "800",
                      fontSize: "var(--font-size-xs)",
                      color: "var(--tier-authentic-gold)",
                    }}
                  >
                    #{sample.orderNumber}
                  </span>
                  <span style={{ fontWeight: "700", fontSize: "var(--font-size-sm)", color: "var(--text-primary)" }}>
                    {sample.label}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{sample.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

