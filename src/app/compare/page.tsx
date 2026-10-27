"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StorefrontShell } from "@/components/layout";
import { ComparisonMatrix, CompareProductItem } from "@/components/compare";

const SAMPLE_COMPARISON_ITEMS: CompareProductItem[] = [
  {
    id: "prod-1",
    slug: "baseus-65w-gan-ultra-fast-charger",
    title: "Baseus GaN5 Pro 65W Triple-Port Fast Charger",
    brand: "Baseus",
    tier: "AUTHENTIC",
    pricePaisa: 345000,
    mrpPaisa: 395000,
    icon: "⚡",
    rating: 4.9,
    specs: {
      maxWattage: "65W Max Output",
      chargingProtocols: "PD 3.0, QC 4+, PPS, AFC, FCP",
      ports: "2x USB-C + 1x USB-A",
      efficiency: "93.5% (GaN5 Architecture)",
      shellMaterial: "V0 Fireproof Polycarbonate",
      internalCooling: "BCT (Baseus Cooling Tech) Graphene",
      weight: "112g",
      oemAttestation: "Official Brand Importer Stock",
      safetyChip: "BPS II Intelligent Power Allocation",
      overVoltageProtection: "Active Surge Guard up to 3000V",
      tempSensor: "Dual NTC Temperature Monitored",
      sealType: "Destructive Tamper-Evident Hologram",
      warrantyDuration: "12 Months Official Distributor Warranty",
      rmaExchangeLocation: "Shop 42, Nawabpur Complex Counter",
      pricePerWatt: "৳53.07 / Watt",
    },
  },
  {
    id: "prod-budget-1",
    slug: "oem-65w-gan-fast-charger-tested",
    title: "OEM Smart 65W Dual-Port GaN Charger (Bench Tested)",
    brand: "Generic OEM",
    tier: "BUDGET_SMART",
    pricePaisa: 175000,
    icon: "🛠️",
    rating: 4.6,
    specs: {
      maxWattage: "65W Peak Output (45W Sustained)",
      chargingProtocols: "PD 3.0, QC 3.0, FCP",
      ports: "1x USB-C + 1x USB-A",
      efficiency: "88.2% (Standard GaN)",
      shellMaterial: "ABS Flame Retardant",
      internalCooling: "Passive Aluminum Heat Sink",
      weight: "96g",
      oemAttestation: "Zero-Replica Generic Tested OEM",
      safetyChip: "Standard PWM IC Controller",
      overVoltageProtection: "Standard Fuse Protection",
      tempSensor: "Single Thermal Cutoff",
      sealType: "NCAMart Budget Smart Verified Hologram",
      warrantyDuration: "3 Months NCAMart In-House Warranty",
      rmaExchangeLocation: "Shop 42, Nawabpur Complex Counter",
      pricePerWatt: "৳26.92 / Watt",
    },
  },
];

function ComparePageContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");

  const [products, setProducts] = useState<CompareProductItem[]>(() => {
    if (idsParam) {
      // In real scenario, matches ids; for demo initializes with sample comparison
      return SAMPLE_COMPARISON_ITEMS;
    }
    return SAMPLE_COMPARISON_ITEMS;
  });

  const handleRemoveProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "var(--space-xl) var(--space-md)",
      }}
    >
      {/* Breadcrumb */}
      <div style={{ marginBottom: "var(--space-md)" }}>
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: "4px" }}>
          <Link href="/" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Home</Link>
          {" / "}
          <Link href="/catalog" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>Catalog</Link>
          {" / "}
          <span style={{ color: "var(--text-secondary)" }}>Side-by-Side Spec Comparison</span>
        </div>

        <h1
          style={{
            fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
            fontWeight: "900",
            color: "var(--text-primary)",
            margin: "0 0 4px",
            letterSpacing: "-0.03em",
          }}
        >
          Side-by-Side Spec Comparison Matrix
        </h1>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--text-secondary)",
            margin: 0,
          }}
        >
          Compare 100% Authentic Distributor products directly against Budget Smart tested OEM alternatives.
        </p>
      </div>

      {/* Comparison Matrix Table */}
      <ComparisonMatrix
        products={products}
        onRemoveProduct={handleRemoveProduct}
      />
    </div>
  );
}

export default function ComparePage() {
  return (
    <StorefrontShell>
      <Suspense
        fallback={
          <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading comparison matrix...
          </div>
        }
      >
        <ComparePageContent />
      </Suspense>
    </StorefrontShell>
  );
}
