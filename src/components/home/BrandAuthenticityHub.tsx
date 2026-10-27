"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";

interface BrandCredential {
  name: string;
  slug: string;
  logo: string;
  tier: "DISTRIBUTOR_AUTHORIZED" | "OFFICIAL_PARTNER" | "FACTORY_DIRECT";
  certificateNo: string;
  warrantyMonths: number;
  country: string;
  distributorName: string;
  verifiedFeatures: string[];
}

const BRANDS: BrandCredential[] = [
  {
    name: "Anker",
    slug: "anker",
    logo: "⚡",
    tier: "DISTRIBUTOR_AUTHORIZED",
    certificateNo: "ANK-BD-2024-991",
    warrantyMonths: 18,
    country: "USA / Global",
    distributorName: "Anker Technologies BD Ltd.",
    verifiedFeatures: ["PowerIQ 4.0 Fast Charge", "Official 18M Replacement", "Original QR Authentication"],
  },
  {
    name: "Baseus",
    slug: "baseus",
    logo: "🔋",
    tier: "DISTRIBUTOR_AUTHORIZED",
    certificateNo: "BAS-BD-2024-412",
    warrantyMonths: 12,
    country: "Shenzhen, China",
    distributorName: "Baseus Bangladesh National Distributor",
    verifiedFeatures: ["BPS II Smart Power Split", "GaN5 Pro Technology", "Mushak 6.3 Registered VAT"],
  },
  {
    name: "UGREEN",
    slug: "ugreen",
    logo: "🔌",
    tier: "DISTRIBUTOR_AUTHORIZED",
    certificateNo: "UGR-BD-2024-118",
    warrantyMonths: 12,
    country: "Hong Kong / Global",
    distributorName: "UGREEN Authorized Importer Dhaka",
    verifiedFeatures: ["E-Marker Certified 100W", "Thermal Guard 2.0", "Holographic Tamper Seal"],
  },
  {
    name: "Fluke",
    slug: "fluke",
    logo: "🔬",
    tier: "OFFICIAL_PARTNER",
    certificateNo: "FLK-CAL-2024-009",
    warrantyMonths: 24,
    country: "USA",
    distributorName: "Precision Instrumentation BD",
    verifiedFeatures: ["NIST Traceable Calibration", "CAT III / CAT IV Certified", "Individual Serial Certificate"],
  },
  {
    name: "Mechanic",
    slug: "mechanic",
    logo: "🔥",
    tier: "FACTORY_DIRECT",
    certificateNo: "MEC-HK-2024-772",
    warrantyMonths: 12,
    country: "Hong Kong",
    distributorName: "Nawabpur Master Tool Importer",
    verifiedFeatures: ["T12 Ceramic Heater Core", "Zero-Counterfeit Attestation", "Original Hologram Label"],
  },
  {
    name: "Sunshine",
    slug: "sunshine",
    logo: "🛠️",
    tier: "FACTORY_DIRECT",
    certificateNo: "SUN-SZ-2024-331",
    warrantyMonths: 6,
    country: "Guangzhou, China",
    distributorName: "Direct Factory Wholesale Stall 14",
    verifiedFeatures: ["SMD Rework Calibrated", "OEM Batch Tested", "Runner Inspected"],
  },
];

export function BrandAuthenticityHub() {
  const [selectedBrand, setSelectedBrand] = useState<BrandCredential | null>(null);

  return (
    <section
      aria-label="Official Brand Authenticity Hub"
      style={{
        padding: "var(--space-2xl) var(--space-md)",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "var(--space-xl)",
          flexWrap: "wrap",
          gap: "var(--space-md)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--tier-authentic-gold)",
              fontWeight: "var(--font-weight-bold)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "4px",
            }}
          >
            VERIFIED DISTRIBUTOR CREDENTIALS
          </div>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
              fontWeight: "800",
              color: "var(--text-primary)",
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            Authorized Brands & Warranty Certificates
          </h2>
        </div>

        <span
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--text-tertiary)",
            fontStyle: "italic",
          }}
        >
          Click any brand to inspect authorization certificate
        </span>
      </div>

      {/* Brand Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-md)",
        }}
      >
        {BRANDS.map((b) => (
          <button
            key={b.slug}
            type="button"
            onClick={() => setSelectedBrand(b)}
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-lg)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              cursor: "pointer",
              transition: "all var(--duration-fast) var(--ease-spring)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
            }}
            className="interactive-scale"
          >
            {/* Logo Avatar */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1.5px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
                marginBottom: "var(--space-sm)",
              }}
            >
              {b.logo}
            </div>

            {/* Name */}
            <div
              style={{
                fontSize: "var(--font-size-base)",
                fontWeight: "800",
                color: "var(--text-primary)",
              }}
            >
              {b.name}
            </div>

            {/* Warranty Badge */}
            <div
              style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "var(--tier-authentic-gold)",
                marginTop: "4px",
              }}
            >
              {b.warrantyMonths} Months Warranty
            </div>

            {/* Certificate Indicator */}
            <div
              style={{
                fontSize: "9px",
                color: "var(--text-tertiary)",
                marginTop: "6px",
                padding: "2px 6px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--bg-canvas)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Cert: {b.certificateNo}
            </div>
          </button>
        ))}
      </div>

      {/* Certificate Modal Dialog */}
      {selectedBrand && (
        <Dialog
          isOpen={!!selectedBrand}
          onClose={() => setSelectedBrand(null)}
          title={`Official Authorization Certificate — ${selectedBrand.name}`}
          description={`Verified distributor credentials for ${selectedBrand.distributorName}`}
          maxWidth="560px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {/* Certificate Visual Box */}
            <div
              style={{
                border: "2px solid var(--tier-authentic-gold)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-lg)",
                backgroundColor: "rgba(245, 158, 11, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-sm)",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px dashed var(--tier-authentic-gold-border)",
                  paddingBottom: "8px",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--tier-authentic-gold)", letterSpacing: "0.08em" }}>
                  DISTRIBUTOR CERTIFICATE OF AUTHENTICITY
                </span>
                <span style={{ fontSize: "14px" }}>🛡️</span>
              </div>

              <div>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Authorized Distributor
                </div>
                <div style={{ fontSize: "var(--font-size-base)", fontWeight: "800", color: "var(--text-primary)" }}>
                  {selectedBrand.distributorName}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Certificate ID</div>
                  <div style={{ fontFamily: "var(--font-family-mono)", fontSize: "11px", fontWeight: "700", color: "var(--text-primary)" }}>
                    {selectedBrand.certificateNo}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Official Warranty</div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--color-status-success)" }}>
                    {selectedBrand.warrantyMonths} Months Direct Replacement
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px dashed var(--tier-authentic-gold-border)", paddingTop: "8px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
                  Verified Authenticity Checks:
                </div>
                {selectedBrand.verifiedFeatures.map((feat) => (
                  <div key={feat} style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", gap: "6px" }}>
                    <span style={{ color: "var(--tier-authentic-gold)" }}>✓</span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)" }}>
              <Link
                href={`/catalog?brand=${encodeURIComponent(selectedBrand.slug)}`}
                onClick={() => setSelectedBrand(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: "var(--tier-authentic-gold)",
                  color: "#0b0f19",
                  fontWeight: "800",
                  fontSize: "var(--font-size-xs)",
                  textDecoration: "none",
                }}
              >
                <span>Browse {selectedBrand.name} Products</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
