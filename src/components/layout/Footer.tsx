"use client";

import React from "react";
import Link from "next/link";
import { AuthenticBadge, BudgetSmartBadge } from "@/components/ui/badge";

export function Footer() {
  return (
    <footer
      className="storefront-footer"
      style={{
        backgroundColor: "var(--bg-canvas)",
        borderTop: "1px solid var(--border-default)",
        padding: "var(--space-4xl) var(--space-xl) var(--space-2xl)",
        marginTop: "auto",
        color: "var(--text-secondary)",
        fontSize: "var(--font-size-sm)",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "var(--space-3xl)",
          paddingBottom: "var(--space-3xl)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {/* Col 1: Brand & Physical Identity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
            <span
              style={{
                fontFamily: "var(--font-family-display)",
                fontWeight: "800",
                fontSize: "22px",
                color: "var(--text-primary)",
              }}
            >
              NCA<span style={{ color: "var(--color-brand-primary)" }}>MART</span>
            </span>
            <span
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                backgroundColor: "var(--tier-authentic-gold-bg)",
                color: "var(--tier-authentic-gold)",
                padding: "2px 6px",
                borderRadius: "var(--radius-xs)",
                fontWeight: "bold",
              }}
            >
              Nawabpur
            </span>
          </div>

          <p style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-relaxed)" }}>
            Bangladesh&apos;s pioneering dual-tier tech accessories wholesale & direct retail hub.
            Anchored physically in Nawabpur Complex, Sundarban Square, Dhaka.
          </p>

          <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
            <AuthenticBadge size="sm" pulse={false} />
            <BudgetSmartBadge size="sm" pulse={false} />
          </div>

          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
            Trade License: TRAD/DSCC/049182/2024 · BIN: 004819201-0101 · BTRC Cleared
          </div>
        </div>

        {/* Col 2: High-Trust Standards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <h4 style={{ color: "var(--text-primary)", fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-base)" }}>
            Dual-Tier Guarantee
          </h4>
          <Link href="/verify" style={{ color: "var(--tier-authentic-gold)", fontWeight: "var(--font-weight-medium)" }}>
            → Verify Holographic Seal (/verify)
          </Link>
          <Link href="/pages/authentic-guarantee" style={{ color: "inherit" }}>
            100% Authentic Money-Back Guarantee
          </Link>
          <Link href="/pages/budget-smart-testing" style={{ color: "inherit" }}>
            Budget Smart 3-Point QC Protocol
          </Link>
          <Link href="/pre-orders" style={{ color: "inherit" }}>
            Pre-Order Milestone Journey & Deposits
          </Link>
          <Link href="/pages/warranty-policy" style={{ color: "inherit" }}>
            RMA & Warranty Claim Process
          </Link>
        </div>

        {/* Col 3: Customer Care & Godown Services */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <h4 style={{ color: "var(--text-primary)", fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-base)" }}>
            Help & Showroom Services
          </h4>
          <Link href="/track" style={{ color: "inherit" }}>
            Track Consignment Status
          </Link>
          <Link href="/showrooms/nawabpur" style={{ color: "inherit" }}>
            Showroom Counter Pickup (PIN Verification)
          </Link>
          <Link href="/pages/shipping-rates" style={{ color: "inherit" }}>
            Delivery Rates (Dhaka ৳60 / National ৳120)
          </Link>
          <Link href="/pages/terms" style={{ color: "inherit" }}>
            Terms & Conditions
          </Link>
          <Link href="/pages/privacy" style={{ color: "inherit" }}>
            Privacy Policy & PII Security
          </Link>
        </div>

        {/* Col 4: Contact & Hotline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <h4 style={{ color: "var(--text-primary)", fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-base)" }}>
            Contact & Operations
          </h4>
          <p style={{ fontSize: "var(--font-size-xs)" }}>
            Showroom: Shop 42 (1st Floor), Nawabpur Complex, Sundarban Square Market, Dhaka-1100
          </p>
          <p style={{ fontSize: "var(--font-size-xs)" }}>
            Hotline: <strong>+880 9610-000000</strong> (9:00 AM – 9:00 PM)
          </p>
          <p style={{ fontSize: "var(--font-size-xs)" }}>
            Email: support@ncamart.com
          </p>
          <div
            style={{
              marginTop: "var(--space-xs)",
              padding: "var(--space-xs) var(--space-sm)",
              backgroundColor: "var(--bg-surface-elevated)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              fontSize: "11px",
              color: "var(--color-success)",
              fontWeight: "var(--font-weight-semibold)",
            }}
          >
            ● Central Godown Dispatch Active (Nawabpur)
          </div>
        </div>
      </div>

      {/* Bottom Legal & Payment Logos */}
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          paddingTop: "var(--space-xl)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-md)",
          fontSize: "var(--font-size-2xs)",
          color: "var(--text-tertiary)",
        }}
      >
        <span>
          © {new Date().getFullYear()} NCAMart Bangladesh Ltd. All rights reserved.
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span>Secure Payments via:</span>
          <span style={{ fontWeight: "bold", color: "var(--text-primary)" }}>SSLCommerz</span> ·
          <span style={{ fontWeight: "bold", color: "var(--color-destructive)" }}>bKash</span> ·
          <span style={{ fontWeight: "bold", color: "var(--color-warning)" }}>Nagad</span> ·
          <span style={{ fontWeight: "bold", color: "var(--text-primary)" }}>Visa / Mastercard</span>
        </div>
      </div>
    </footer>
  );
}
