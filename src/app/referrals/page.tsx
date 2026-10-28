import React from "react";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";

export default function ReferralsPage() {
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
              backgroundColor: "var(--tier-budget-teal-bg)",
              color: "var(--tier-budget-teal)",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            🤝 ENGINEER REFERRAL NETWORK
          </span>
          <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
            Invite Fellow Tech Engineers & Earn ৳250 Store Credit
          </h1>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            Share your NCAMart referral code with fellow repair technicians, hardware labs, and makers across Bangladesh.
            When their first order passes Godown QC and delivery, both accounts receive ৳250 in Store Credit.
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
              💳 View Store Credit Balance →
            </Link>
            <Link
              href="/auth/login"
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
              Sign In to Get Referral Link
            </Link>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

