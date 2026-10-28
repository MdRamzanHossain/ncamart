import React from "react";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";

export default function RewardsPage() {
  return (
    <StorefrontShell>
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "var(--space-3xl) var(--space-md) var(--space-4xl)" }}>
        <div
          style={{
            borderRadius: "var(--radius-xl)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            padding: "var(--space-2xl)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-lg)",
          }}
        >
          <span
            style={{
              alignSelf: "flex-start",
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--tier-authentic-gold-bg)",
              color: "var(--tier-authentic-gold)",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            💎 PRO ENGINEER LOYALTY CLUB
          </span>
          <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
            NCAMart Engineering Rewards & Store Credit Cashback
          </h1>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            Every verified purchase at NCAMart earns instant Store Credit points redeemable on GaN chargers, soldering
            stations, and pre-order balance settlements.
          </p>
          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
            <Link
              href="/account/wallet"
              style={{
                padding: "12px 20px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-brand-primary)",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "var(--font-size-sm)",
                textDecoration: "none",
              }}
            >
              💳 Open My Store Credit Wallet →
            </Link>
            <Link
              href="/catalog"
              style={{
                padding: "12px 20px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                fontWeight: 700,
                fontSize: "var(--font-size-sm)",
                textDecoration: "none",
              }}
            >
              Browse Eligible Products
            </Link>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

