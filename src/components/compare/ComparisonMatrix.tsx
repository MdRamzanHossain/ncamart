"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatPaisa } from "@/lib/money";
import { AuthenticBadge, BudgetSmartBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export interface CompareProductItem {
  id: string;
  slug: string;
  title: string;
  brand: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  pricePaisa: number;
  mrpPaisa?: number;
  icon: string;
  rating: number;
  specs: {
    // 1. Performance & Output
    maxWattage: string;
    chargingProtocols: string;
    ports: string;
    efficiency: string;
    // 2. Build Quality & Housing
    shellMaterial: string;
    internalCooling: string;
    weight: string;
    oemAttestation: string;
    // 3. Safety Protections
    safetyChip: string;
    overVoltageProtection: string;
    tempSensor: string;
    // 4. Warranty & Seal Type
    sealType: string;
    warrantyDuration: string;
    rmaExchangeLocation: string;
    // 5. Value & Ratio
    pricePerWatt: string;
  };
}

interface SpecRowDef {
  key: keyof CompareProductItem["specs"];
  label: string;
  category: "Performance" | "Build" | "Safety" | "Warranty" | "Value";
}

const SPEC_ROWS: SpecRowDef[] = [
  // Performance
  { key: "maxWattage", label: "Max Wattage", category: "Performance" },
  { key: "chargingProtocols", label: "Fast Charge Protocols", category: "Performance" },
  { key: "ports", label: "Port Configuration", category: "Performance" },
  { key: "efficiency", label: "Efficiency Rating", category: "Performance" },
  // Build
  { key: "shellMaterial", label: "Housing Material", category: "Build" },
  { key: "internalCooling", label: "Heat Dissipation Architecture", category: "Build" },
  { key: "weight", label: "Weight", category: "Build" },
  { key: "oemAttestation", label: "Zero-Replica Attestation", category: "Build" },
  // Safety
  { key: "safetyChip", label: "Integrated Power IC", category: "Safety" },
  { key: "overVoltageProtection", label: "Surge & Over-voltage", category: "Safety" },
  { key: "tempSensor", label: "Real-time Temperature Guard", category: "Safety" },
  // Warranty
  { key: "sealType", label: "Physical Verification Seal", category: "Warranty" },
  { key: "warrantyDuration", label: "Warranty Coverage", category: "Warranty" },
  { key: "rmaExchangeLocation", label: "RMA Service Center", category: "Warranty" },
  // Value
  { key: "pricePerWatt", label: "Price / Watt Ratio", category: "Value" },
];

interface ComparisonMatrixProps {
  products: CompareProductItem[];
  onRemoveProduct: (id: string) => void;
}

export function ComparisonMatrix({
  products,
  onRemoveProduct,
}: ComparisonMatrixProps) {
  const { toast } = useToast();
  const [highlightDifferences, setHighlightDifferences] = useState(true);

  if (products.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-3xl) var(--space-md)",
          textAlign: "center",
          backgroundColor: "var(--bg-surface)",
          border: "1px dashed var(--border-default)",
          borderRadius: "var(--radius-xl)",
          maxWidth: "600px",
          margin: "var(--space-2xl) auto",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "var(--space-md)" }}>⚖️</div>
        <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: "800", color: "var(--text-primary)", margin: "0 0 6px" }}>
          No Products Selected For Comparison
        </h2>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", margin: "0 0 var(--space-lg)" }}>
          Browse our master catalog and check the &ldquo;Compare&rdquo; box on any 2 to 4 items to see a detailed side-by-side spec comparison.
        </p>
        <Link
          href="/catalog"
          style={{
            padding: "10px 24px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--tier-authentic-gold)",
            color: "#0b0f19",
            fontWeight: "800",
            fontSize: "var(--font-size-sm)",
            textDecoration: "none",
          }}
        >
          Browse Catalog →
        </Link>
      </div>
    );
  }

  const handleAddToCart = (item: CompareProductItem) => {
    toast({
      variant: "success",
      title: "Added to Cart 🛒",
      description: `${item.title} (৳${formatPaisa(item.pricePaisa)})`,
    });
  };

  // Helper to determine if values differ across compared products for a spec
  const isSpecDifferent = (key: keyof CompareProductItem["specs"]) => {
    if (products.length < 2) return false;
    const firstVal = products[0].specs[key];
    return products.some((p) => p.specs[key] !== firstVal);
  };

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      {/* Top Controls: Difference Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-lg)",
          flexWrap: "wrap",
          gap: "var(--space-md)",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            backgroundColor: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-full)",
            padding: "8px 16px",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={highlightDifferences}
            onChange={(e) => setHighlightDifferences(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
          <span style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--text-primary)" }}>
            ⚡ Highlight Contrasting Specs Only
          </span>
        </label>

        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
          Comparing {products.length} products side-by-side
        </div>
      </div>

      {/* Comparison Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
        }}
      >
        {/* Sticky Product Headers */}
        <thead>
          <tr style={{ backgroundColor: "var(--bg-surface-elevated)" }}>
            {/* First Column: Metric Label Header */}
            <th
              style={{
                width: "220px",
                padding: "var(--space-lg)",
                textAlign: "left",
                borderBottom: "2px solid var(--border-default)",
                borderRight: "1px solid var(--border-subtle)",
                position: "sticky",
                left: 0,
                backgroundColor: "var(--bg-surface-elevated)",
                zIndex: 10,
              }}
            >
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: "900", color: "var(--text-primary)" }}>
                Specification
              </span>
            </th>

            {/* Product Column Headers */}
            {products.map((item) => {
              const isAuthentic = item.tier === "AUTHENTIC";

              return (
                <th
                  key={item.id}
                  style={{
                    minWidth: "240px",
                    maxWidth: "280px",
                    padding: "var(--space-lg)",
                    textAlign: "center",
                    borderBottom: "2px solid var(--border-default)",
                    borderRight: "1px solid var(--border-subtle)",
                    verticalAlign: "top",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    {/* Remove Action */}
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(item.id)}
                      style={{
                        alignSelf: "flex-end",
                        background: "none",
                        border: "none",
                        color: "var(--text-tertiary)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                      aria-label={`Remove ${item.title}`}
                    >
                      ✕ Remove
                    </button>

                    {/* Thumbnail */}
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "var(--radius-lg)",
                        backgroundColor: "var(--bg-canvas)",
                        border: `1.5px solid ${isAuthentic ? "var(--tier-authentic-gold)" : "var(--tier-budget-teal)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "36px",
                      }}
                    >
                      {item.icon}
                    </div>

                    {/* Tier Badge */}
                    <div>
                      {isAuthentic ? <AuthenticBadge size="sm" /> : <BudgetSmartBadge size="sm" />}
                    </div>

                    {/* Title */}
                    <div
                      style={{
                        fontSize: "var(--font-size-xs)",
                        fontWeight: "700",
                        color: "var(--text-primary)",
                        lineHeight: "1.4",
                        height: "34px",
                        overflow: "hidden",
                      }}
                    >
                      {item.title}
                    </div>

                    {/* Price */}
                    <div
                      style={{
                        fontFamily: "var(--font-family-mono)",
                        fontWeight: "900",
                        fontSize: "var(--font-size-base)",
                        color: isAuthentic ? "var(--tier-authentic-gold)" : "var(--tier-budget-teal)",
                      }}
                    >
                      ৳{formatPaisa(item.pricePaisa)}
                    </div>

                    {/* Add to Cart CTA */}
                    <button
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      style={{
                        marginTop: "4px",
                        width: "100%",
                        padding: "8px 16px",
                        borderRadius: "var(--radius-full)",
                        backgroundColor: "var(--color-brand-primary)",
                        color: "#ffffff",
                        fontWeight: "700",
                        fontSize: "var(--font-size-xs)",
                        border: "none",
                        cursor: "pointer",
                        boxShadow: "0 2px 8px var(--color-brand-primary-glow)",
                      }}
                      className="interactive-scale"
                    >
                      Add to Cart
                    </button>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Spec Rows */}
        <tbody>
          {SPEC_ROWS.map((rowDef, index) => {
            const hasDifference = isSpecDifferent(rowDef.key);
            const isDimmed = highlightDifferences && !hasDifference;

            return (
              <tr
                key={rowDef.key}
                style={{
                  backgroundColor: index % 2 === 0 ? "transparent" : "var(--bg-surface-elevated)",
                  opacity: isDimmed ? 0.35 : 1,
                  transition: "opacity var(--duration-fast) ease",
                }}
              >
                {/* Metric Label */}
                <td
                  style={{
                    padding: "12px var(--space-lg)",
                    fontSize: "var(--font-size-xs)",
                    fontWeight: "700",
                    color: "var(--text-secondary)",
                    borderBottom: "1px solid var(--border-subtle)",
                    borderRight: "1px solid var(--border-subtle)",
                    position: "sticky",
                    left: 0,
                    backgroundColor: index % 2 === 0 ? "var(--bg-surface)" : "var(--bg-surface-elevated)",
                    zIndex: 5,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {hasDifference && highlightDifferences && (
                      <span style={{ color: "var(--tier-authentic-gold)", fontSize: "10px" }}>⚡</span>
                    )}
                    <span>{rowDef.label}</span>
                  </div>
                </td>

                {/* Values for each Product */}
                {products.map((item) => {
                  const val = item.specs[rowDef.key];
                  const isAuthentic = item.tier === "AUTHENTIC";

                  return (
                    <td
                      key={item.id}
                      style={{
                        padding: "12px var(--space-md)",
                        textAlign: "center",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--text-primary)",
                        borderBottom: "1px solid var(--border-subtle)",
                        borderRight: "1px solid var(--border-subtle)",
                        fontWeight: hasDifference ? "700" : "500",
                        backgroundColor:
                          hasDifference && highlightDifferences
                            ? isAuthentic
                              ? "rgba(245, 158, 11, 0.08)"
                              : "rgba(20, 184, 166, 0.08)"
                            : "transparent",
                      }}
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
