"use client";

import React, { useState } from "react";

export interface CatalogFilterState {
  tier?: "AUTHENTIC" | "BUDGET_SMART" | "";
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  wattage?: string;
}

interface FacetedFilterSidebarProps {
  filters: CatalogFilterState;
  onFilterChange: (newFilters: CatalogFilterState) => void;
  onReset: () => void;
}

const CATEGORY_FACETS = [
  { slug: "engineering-tools", name: "Engineering Tools", count: 230 },
  { slug: "chargers-power", name: "GaN & Fast Chargers", count: 141 },
  { slug: "cables-adapters", name: "Industrial Utility Cables", count: 185 },
  { slug: "smart-wearables", name: "Smart Wearables", count: 94 },
  { slug: "cctv-surveillance", name: "CCTV & Security", count: 120 },
];

const BRAND_FACETS = [
  "Anker",
  "Baseus",
  "UGREEN",
  "Fluke",
  "Mechanic",
  "Sunshine",
  "Kaisi",
  "Relife",
  "Generic OEM",
];

const WATTAGE_OPTIONS = ["30W", "65W", "100W", "140W"];

export function FacetedFilterSidebar({
  filters,
  onFilterChange,
  onReset,
}: FacetedFilterSidebarProps) {
  const [brandSearch, setBrandSearch] = useState("");

  const filteredBrands = BRAND_FACETS.filter((b) =>
    b.toLowerCase().includes(brandSearch.toLowerCase().trim())
  );

  return (
    <aside
      aria-label="Product Filters"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-lg)",
      }}
    >
      {/* Header & Reset */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "var(--space-sm)",
        }}
      >
        <span
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: "800",
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          Filters
        </span>
        <button
          type="button"
          onClick={onReset}
          style={{
            background: "none",
            border: "none",
            fontSize: "var(--font-size-xs)",
            fontWeight: "700",
            color: "var(--tier-authentic-gold)",
            cursor: "pointer",
          }}
        >
          Reset All
        </button>
      </div>

      {/* 1. Dual-Tier Selector */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-tertiary)",
            marginBottom: "var(--space-xs)",
          }}
        >
          Authenticity Tier
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "var(--font-size-xs)",
              color: "var(--text-primary)",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <input
              type="radio"
              name="tier"
              checked={!filters.tier}
              onChange={() => onFilterChange({ ...filters, tier: "" })}
            />
            <span>All Tiers</span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "var(--font-size-xs)",
              color: "var(--tier-authentic-gold)",
              fontWeight: "700",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--tier-authentic-gold-bg)",
            }}
          >
            <input
              type="radio"
              name="tier"
              checked={filters.tier === "AUTHENTIC"}
              onChange={() => onFilterChange({ ...filters, tier: "AUTHENTIC" })}
            />
            <span>✨ 100% Authentic Guaranteed</span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "var(--font-size-xs)",
              color: "var(--tier-budget-teal)",
              fontWeight: "700",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--tier-budget-teal-bg)",
            }}
          >
            <input
              type="radio"
              name="tier"
              checked={filters.tier === "BUDGET_SMART"}
              onChange={() => onFilterChange({ ...filters, tier: "BUDGET_SMART" })}
            />
            <span>⚡ Budget Smart (Tested OEM)</span>
          </label>
        </div>
      </div>

      {/* 2. In-Stock Fast Dispatch Toggle */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "var(--space-md)",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--text-primary)" }}>
              24h Dhaka Dispatch
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
              Physical Godown Stock
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!filters.inStockOnly}
            onChange={(e) => onFilterChange({ ...filters, inStockOnly: e.target.checked })}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
        </label>
      </div>

      {/* 3. Category Hierarchy */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "var(--space-md)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-tertiary)",
            marginBottom: "var(--space-xs)",
          }}
        >
          Categories
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, category: "" })}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: !filters.category ? "var(--bg-surface-elevated)" : "none",
              border: "none",
              padding: "6px 8px",
              borderRadius: "var(--radius-sm)",
              color: !filters.category ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: !filters.category ? "700" : "500",
              fontSize: "var(--font-size-xs)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span>All Categories</span>
          </button>

          {CATEGORY_FACETS.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onFilterChange({ ...filters, category: cat.slug })}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: filters.category === cat.slug ? "var(--bg-surface-elevated)" : "none",
                border: "none",
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                color: filters.category === cat.slug ? "var(--tier-authentic-gold)" : "var(--text-secondary)",
                fontWeight: filters.category === cat.slug ? "700" : "500",
                fontSize: "var(--font-size-xs)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>{cat.name}</span>
              <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Price Range (BDT ৳) */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "var(--space-md)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-tertiary)",
            marginBottom: "var(--space-xs)",
          }}
        >
          Price Range (BDT ৳)
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="number"
            placeholder="Min ৳"
            value={filters.minPrice || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                minPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            style={{
              width: "100%",
              padding: "6px 8px",
              backgroundColor: "var(--bg-canvas)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--font-size-xs)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-family-mono)",
            }}
          />
          <span style={{ color: "var(--text-tertiary)" }}>-</span>
          <input
            type="number"
            placeholder="Max ৳"
            value={filters.maxPrice || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            style={{
              width: "100%",
              padding: "6px 8px",
              backgroundColor: "var(--bg-canvas)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--font-size-xs)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-family-mono)",
            }}
          />
        </div>
      </div>

      {/* 5. Brand Checkboxes with Live Search */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "var(--space-md)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-tertiary)",
            marginBottom: "var(--space-xs)",
          }}
        >
          Brands
        </div>

        {/* Live Search Inside Brand List */}
        <input
          type="text"
          placeholder="Search brands..."
          value={brandSearch}
          onChange={(e) => setBrandSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 10px",
            backgroundColor: "var(--bg-canvas)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            fontSize: "11px",
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        />

        <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          {filteredBrands.map((brand) => (
            <label
              key={brand}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "var(--font-size-xs)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: "2px 0",
              }}
            >
              <input
                type="radio"
                name="brand"
                checked={filters.brand === brand.toLowerCase()}
                onChange={() =>
                  onFilterChange({
                    ...filters,
                    brand: filters.brand === brand.toLowerCase() ? "" : brand.toLowerCase(),
                  })
                }
              />
              <span>{brand}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 6. Technical Spec: Wattage */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "var(--space-md)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-tertiary)",
            marginBottom: "var(--space-xs)",
          }}
        >
          Wattage / Power
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {WATTAGE_OPTIONS.map((watt) => (
            <button
              key={watt}
              type="button"
              onClick={() =>
                onFilterChange({
                  ...filters,
                  wattage: filters.wattage === watt ? "" : watt,
                })
              }
              style={{
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid",
                borderColor: filters.wattage === watt ? "var(--tier-authentic-gold)" : "var(--border-default)",
                backgroundColor: filters.wattage === watt ? "var(--tier-authentic-gold-bg)" : "var(--bg-canvas)",
                color: filters.wattage === watt ? "var(--tier-authentic-gold)" : "var(--text-secondary)",
                fontSize: "10px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {watt}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
