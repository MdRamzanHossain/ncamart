import React from "react";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";

export default function AuthenticityPartnersPage() {
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
            📜 AUTHORIZED DISTRIBUTOR NETWORK
          </span>
          <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
            Distributor-Verified Supply Chain & Mushak 6.3 VAT Compliance
          </h1>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            NCAMart partners directly with authorized importers for Anker, Baseus, UGREEN, Mechanic, Fluke, and AIFEN.
            Every Authentic-tier unit is sealed with a unique Crockford Base32 hologram at our Nawabpur Godown.
          </p>
          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
            <Link
              href="/verify"
              style={{
                padding: "12px 20px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--tier-authentic-gold)",
                color: "#0b0f19",
                fontWeight: 800,
                fontSize: "var(--font-size-sm)",
                textDecoration: "none",
              }}
            >
              🛡️ Verify a Holographic Seal (/verify) →
            </Link>
            <Link
              href="/catalog?tier=AUTHENTIC"
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
              Shop 100% Authentic Catalog
            </Link>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

