"use client";

import React from "react";
import Link from "next/link";
import { CatalogProduct } from "@/components/catalog";

interface ComparisonTrayProps {
  products: CatalogProduct[];
  onRemove: (productId: string) => void;
  onClear: () => void;
}

export function ComparisonTray({ products, onRemove, onClear }: ComparisonTrayProps) {
  if (products.length === 0) return null;

  const compareUrl = `/compare?ids=${products.map((p) => p.id).join(",")}`;

  return (
    <div
      aria-label="Floating Comparison Tray"
      style={{
        position: "fixed",
        bottom: "max(env(safe-area-inset-bottom, 24px), 24px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "var(--z-index-sticky)",
        backgroundColor: "rgba(18, 24, 38, 0.95)",
        border: "1.5px solid var(--tier-authentic-gold)",
        borderRadius: "var(--radius-xl)",
        padding: "10px 18px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(245, 158, 11, 0.35)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-md)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        animation: "slideUp var(--duration-fast) cubic-bezier(0.16, 1, 0.3, 1)",
        maxWidth: "92vw",
      }}
    >
      {/* Thumbnails of items being compared */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-canvas)",
              border: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              position: "relative",
            }}
          >
            <span>{p.icon || (p.product_tier === "AUTHENTIC" ? "⚡" : "🛠️")}</span>
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                color: "#ffffff",
                border: "none",
                fontSize: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
              }}
              aria-label={`Remove ${p.title_en} from comparison`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Item Count & Info */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "var(--font-size-xs)", fontWeight: "800", color: "var(--text-primary)" }}>
          {products.length} / 4 Selected
        </div>
        <button
          type="button"
          onClick={onClear}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: "10px",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            textAlign: "left",
            textDecoration: "underline",
          }}
        >
          Clear all
        </button>
      </div>

      {/* Compare Now CTA */}
      <Link
        href={compareUrl}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 18px",
          borderRadius: "var(--radius-full)",
          backgroundColor: "var(--tier-authentic-gold)",
          color: "#0b0f19",
          fontWeight: "800",
          fontSize: "var(--font-size-xs)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 10px rgba(245, 158, 11, 0.4)",
        }}
        className="interactive-scale"
      >
        <span>Compare Now ({products.length})</span>
        <span>→</span>
      </Link>
    </div>
  );
}
