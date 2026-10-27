"use client";

import React from "react";
import { ProductCard, CatalogProduct } from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductGridProps {
  products: CatalogProduct[];
  isLoading: boolean;
  comparedIds?: string[];
  onToggleCompare?: (product: CatalogProduct) => void;
  onClearFilters?: () => void;
}

export function ProductGrid({
  products,
  isLoading,
  comparedIds = [],
  onToggleCompare,
  onClearFilters,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "var(--space-lg)",
        }}
      >
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            <Skeleton variant="card" height="160px" />
            <Skeleton variant="text" width="60%" height="16px" />
            <Skeleton variant="text" width="90%" height="20px" />
            <Skeleton variant="text" width="40%" height="16px" />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-sm)" }}>
              <Skeleton variant="text" width="50%" height="24px" />
              <Skeleton variant="rounded" width="70px" height="32px" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-3xl) var(--space-md)",
          textAlign: "center",
          backgroundColor: "var(--bg-surface)",
          border: "1px dashed var(--border-default)",
          borderRadius: "var(--radius-xl)",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "var(--space-md)" }}>🔍</div>
        <h3
          style={{
            fontSize: "var(--font-size-lg)",
            fontWeight: "800",
            color: "var(--text-primary)",
            margin: "0 0 6px",
          }}
        >
          No Matching Products Found
        </h3>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--text-secondary)",
            maxWidth: "460px",
            margin: "0 0 var(--space-md)",
          }}
        >
          We couldn&apos;t find any hardware matching your selected filters. Try broadening your criteria or reset the filters.
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--tier-authentic-gold)",
              color: "#0b0f19",
              border: "none",
              fontWeight: "700",
              fontSize: "var(--font-size-xs)",
              cursor: "pointer",
            }}
            className="interactive-scale"
          >
            Clear All Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "var(--space-lg)",
      }}
    >
      {products.map((prod) => (
        <ProductCard
          key={prod.id}
          product={prod}
          isCompared={comparedIds.includes(prod.id)}
          onToggleCompare={onToggleCompare}
        />
      ))}
    </div>
  );
}
