"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";

export default function TrackConsignmentPage() {
  const router = useRouter();
  const [orderInput, setOrderInput] = useState("");

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
            Enter your NCAMart Order Number (sent via SMS & WhatsApp invoice) to view real-time runner stall sourcing,
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
              placeholder="Enter Order # (e.g. NCA-2026-XXXXX)"
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

          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: "var(--space-lg)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-md)",
              fontSize: "var(--font-size-xs)",
              color: "var(--text-secondary)",
            }}
          >
            <span>
              Where is my Order Number? Check your order confirmation SMS/WhatsApp message or sign in to view your full order history.
            </span>
            <Link
              href="/account/orders"
              style={{
                color: "var(--color-brand-primary)",
                fontWeight: "700",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              View My Orders →
            </Link>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

