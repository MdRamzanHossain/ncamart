import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";

export const metadata: Metadata = {
  title: "Nawabpur Complex Flagship Showroom & Counter Pickup | NCAMart",
  description:
    "Visit Shop 42 (1st Floor), Nawabpur Complex, Sundarban Square Market, Dhaka-1100 for instant 6-digit PIN order pickup and live bench testing.",
};

export default function NawabpurShowroomPage() {
  return (
    <StorefrontShell>
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "var(--space-3xl) var(--space-md) var(--space-4xl)",
        }}
      >
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }}>
          <Link href="/" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
            Storefront
          </Link>
          {" / "}
          <span style={{ color: "var(--text-secondary)" }}>Showroom & Counter Pickup</span>
        </div>

        <div
          style={{
            borderRadius: "var(--radius-xl)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            padding: "var(--space-2xl)",
            boxShadow: "var(--shadow-xl)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xl)",
          }}
        >
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--tier-authentic-gold-bg)",
                color: "var(--tier-authentic-gold)",
                fontSize: "11px",
                fontWeight: 800,
                marginBottom: "8px",
              }}
            >
              PHYSICAL HUB · DHAKA-1100
            </span>
            <h1
              style={{
                fontSize: "clamp(1.6rem, 3vw, 2.3rem)",
                fontWeight: 900,
                color: "var(--text-primary)",
                margin: "0 0 8px",
              }}
            >
              Shop 42, Nawabpur Complex (Sundarban Square Market)
            </h1>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
              Experience live multimeter & oscilloscope bench testing, collect online Click-and-Collect orders using your
              6-digit Pickup PIN, or purchase directly from our Showroom Counter POS.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "var(--space-lg)",
            }}
          >
            <div
              style={{
                padding: "var(--space-lg)",
                borderRadius: "var(--radius-lg)",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>
                📍 Showroom Coordinates
              </h2>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Shop 42 (1st Floor), Nawabpur Complex, Sundarban Square Supermarket, Gulistan / Nawabpur Road, Dhaka-1100.
                <br />
                <strong>Hours:</strong> Sat – Thu (10:00 AM – 8:30 PM)
              </p>
            </div>

            <div
              style={{
                padding: "var(--space-lg)",
                borderRadius: "var(--radius-lg)",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>
                🔑 6-Digit PIN Counter Handover
              </h2>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Select &ldquo;Showroom Pickup&rdquo; at checkout for ৳0 delivery fee. Present your 6-digit PIN at our
                POS counter for instant holographic-sealed handover and thermal VAT invoice printing.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
            <Link
              href="/catalog"
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
              Browse Stock for Counter Pickup →
            </Link>
            <Link
              href="/pos"
              style={{
                padding: "12px 20px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                fontWeight: 700,
                fontSize: "var(--font-size-sm)",
                textDecoration: "none",
              }}
            >
              🖥️ Open Showroom POS Console (/pos)
            </Link>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

