"use client";

import React from "react";
import { CatalogFilterState } from "./FacetedFilterSidebar";

interface CatalogHeaderProps {
  totalItems: number;
  shownItems: number;
  filters: CatalogFilterState;
  sort: string;
  onSortChange: (sort: string) => void;
  onRemoveFilter: (key: keyof CatalogFilterState) => void;
  onClearAll: () => void;
  onOpenMobileFilters: () => void;
}

export function CatalogHeader({
  totalItems,
  shownItems,
  filters,
  sort,
  onSortChange,
  onRemoveFilter,
  onClearAll,
  onOpenMobileFilters,
}: CatalogHeaderProps) {
  const activeFilterList: { key: keyof CatalogFilterState; label: string }[] = [];

  if (filters.tier) {
    activeFilterList.push({
      key: "tier",
      label: filters.tier === "AUTHENTIC" ? "✨ 100% Authentic" : "⚡ Budget Smart OEM",
    });
  }
  if (filters.category) {
    activeFilterList.push({
      key: "category",
      label: `Category: ${filters.category}`,
    });
  }
  if (filters.brand) {
    activeFilterList.push({
      key: "brand",
      label: `Brand: ${filters.brand}`,
    });
  }
  if (filters.minPrice || filters.maxPrice) {
    activeFilterList.push({
      key: "minPrice",
      label: `৳${filters.minPrice || 0} - ৳${filters.maxPrice || "Max"}`,
    });
  }
  if (filters.inStockOnly) {
    activeFilterList.push({
      key: "inStockOnly",
      label: "24h Dhaka Dispatch",
    });
  }
  if (filters.wattage) {
    activeFilterList.push({
      key: "wattage",
      label: `Power: ${filters.wattage}`,
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        marginBottom: "var(--space-md)",
      }}
    >
      {/* Top Controls Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-md)",
        }}
      >
        {/* Count */}
        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
          Showing <span style={{ fontWeight: "800", color: "var(--text-primary)" }}>{shownItems}</span> of{" "}
          <span style={{ fontWeight: "800", color: "var(--text-primary)" }}>{totalItems}</span> items
        </div>

        {/* Right Controls: Sort Dropdown & Mobile Filter Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          {/* Mobile Filter Toggle */}
          <button
            type="button"
            onClick={onOpenMobileFilters}
            style={{
              display: "none",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              fontSize: "var(--font-size-xs)",
              fontWeight: "700",
              cursor: "pointer",
            }}
            className="mobile-filter-btn"
          >
            <span>⚙️</span>
            <span>Filters</span>
          </button>

          {/* Sort Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
              Sort:
            </span>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              style={{
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "6px 12px",
                fontSize: "var(--font-size-xs)",
                fontWeight: "600",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="NEWEST">Newest Arrivals</option>
              <option value="PRICE_ASC">Price: Low to High</option>
              <option value="PRICE_DESC">Price: High to Low</option>
              <option value="POPULAR">Popularity</option>
              <option value="FASTEST_DELIVERY">Fastest Delivery (24h)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Pills Bar */}
      {activeFilterList.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
            paddingTop: "var(--space-xs)",
          }}
        >
          {activeFilterList.map((item) => (
            <span
              key={item.key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-default)",
                fontSize: "11px",
                fontWeight: "600",
                color: "var(--text-secondary)",
              }}
            >
              <span>{item.label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter(item.key)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  padding: "0 2px",
                }}
                aria-label={`Remove filter ${item.label}`}
              >
                ✕
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={onClearAll}
            style={{
              background: "none",
              border: "none",
              color: "var(--tier-authentic-gold)",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            Clear All
          </button>
        </div>
      )}

      <style jsx global>{`
        @media (max-width: 900px) {
          .mobile-filter-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
}
