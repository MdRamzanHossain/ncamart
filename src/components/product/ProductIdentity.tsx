"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ProductTier } from "@/modules/catalog/dto";
import { Dialog } from "@/components/ui/dialog";

export interface ProductIdentityProps {
  titleEn: string;
  titleBn?: string | null;
  skuCode: string;
  brandName: string | null;
  brandSlug?: string | null;
  categoryName: string;
  categorySlug: string;
  tier: ProductTier;
  rating: number;
  reviewsCount: number;
}

export function ProductIdentity({
  titleEn,
  titleBn,
  skuCode,
  brandName,
  brandSlug,
  categoryName,
  categorySlug,
  tier,
  rating,
  reviewsCount,
}: ProductIdentityProps) {
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);

  const isAuthentic = tier === "AUTHENTIC";

  const handleCopySku = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(skuCode);
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {/* Dynamic Breadcrumbs */}
      <nav
        aria-label="Breadcrumbs"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#94a3b8",
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}>
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/products?category=${encodeURIComponent(categorySlug)}`}
          style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}
        >
          {categoryName}
        </Link>
        {brandName && (
          <>
            <span>/</span>
            <Link
              href={`/products?brand=${encodeURIComponent(brandSlug || brandName.toLowerCase())}`}
              style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.2s" }}
            >
              {brandName}
            </Link>
          </>
        )}
        <span>/</span>
        <span style={{ color: "#cbd5e1", fontWeight: 500 }} aria-current="page">
          {titleEn.length > 38 ? `${titleEn.substring(0, 38)}...` : titleEn}
        </span>
      </nav>

      {/* Tier Badge & SKU Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        {/* Prominent Tier Badge with "Why this tier?" trigger */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.03em",
              backgroundColor: isAuthentic ? "rgba(245, 158, 11, 0.12)" : "rgba(20, 184, 166, 0.12)",
              color: isAuthentic ? "#f59e0b" : "#14b8a6",
              border: isAuthentic ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(20, 184, 166, 0.35)",
              boxShadow: isAuthentic ? "0 0 12px rgba(245, 158, 11, 0.2)" : "0 0 12px rgba(20, 184, 166, 0.2)",
            }}
          >
            {isAuthentic ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-2 16l-4-4 1.41-1.41L10 15.17l6.59-6.59L18 10l-8 8z" />
                </svg>
                <span>100% Authentic Guaranteed</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v2c0 1.1.9 2 2 2h3c0 1.66 1.34 3 3 3s3-1.34 3-3h3c1.1 0 2-.9 2-2v-2c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-8-5c.55 0 1 .45 1 1h-2c0-.55.45-1 1-1zm6 13H6V7h12v10z" />
                </svg>
                <span>Budget Smart (Tested OEM)</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsTierModalOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "#3b82f6",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 6px",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Why this tier?
          </button>
        </div>

        {/* Copyable SKU */}
        <button
          type="button"
          onClick={handleCopySku}
          title="Click to copy SKU"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "11px",
            fontFamily: "monospace",
            color: copiedSku ? "#10b981" : "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s ease",
          }}
        >
          <span>SKU: {skuCode}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {copiedSku ? (
              <polyline points="20 6 9 17 4 12" />
            ) : (
              <>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Main Title */}
      <div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "#f8fafc",
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
            margin: "4px 0 0 0",
          }}
        >
          {titleEn}
        </h1>
        {titleBn && (
          <p
            style={{
              fontSize: "15px",
              color: "#94a3b8",
              marginTop: "4px",
              lineHeight: 1.4,
            }}
          >
            {titleBn}
          </p>
        )}
      </div>

      {/* Ratings & Jump to Reviews Link */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3px", color: "#f59e0b" }}>
          {"★".repeat(Math.round(rating))}
          <span style={{ color: "#64748b" }}>{"★".repeat(5 - Math.round(rating))}</span>
          <span style={{ fontWeight: 700, color: "#f8fafc", marginLeft: "4px" }}>
            {rating.toFixed(1)}
          </span>
        </div>
        <span style={{ color: "#475569" }}>•</span>
        <a
          href="#reviews"
          style={{
            color: "#3b82f6",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>{reviewsCount} customer reviews</span>
          <span style={{ fontSize: "11px" }}>↓</span>
        </a>
        <span style={{ color: "#475569" }}>•</span>
        <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }} />
          Verified In-Stock Nawabpur
        </span>
      </div>

      {/* Dual-Tier Explainer Dialog */}
      <Dialog
        isOpen={isTierModalOpen}
        onClose={() => setIsTierModalOpen(false)}
        title="NCAMart Dual-Tier Quality Standards"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", color: "#e2e8f0" }}>
          <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.6 }}>
            At Nawabpur Complex, we believe in radical transparency. Every single SKU in our catalog is strictly categorized into one of two transparent tiers:
          </p>

          {/* Authentic Tier Card */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(245, 158, 11, 0.05)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f59e0b", fontWeight: 700, fontSize: "15px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-2 16l-4-4 1.41-1.41L10 15.17l6.59-6.59L18 10l-8 8z" />
              </svg>
              <span>100% Authentic Tier (Official Brand)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6 }}>
              <li>Directly sourced from authorized Bangladesh national distributors or verified global channels.</li>
              <li>Protected by tamper-evident serialized holographic seal (Crockford Base32 ID).</li>
              <li>Includes full manufacturer distributor warranty (12–24 months) + official invoice.</li>
              <li>Strict Zero-Replica Attestation backing each item.</li>
            </ul>
          </div>

          {/* Budget Smart Tier Card */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(20, 184, 166, 0.05)",
              border: "1px solid rgba(20, 184, 166, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#14b8a6", fontWeight: 700, fontSize: "15px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v2c0 1.1.9 2 2 2h3c0 1.66 1.34 3 3 3s3-1.34 3-3h3c1.1 0 2-.9 2-2v-2c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-8-5c.55 0 1 .45 1 1h-2c0-.55.45-1 1-1zm6 13H6V7h12v10z" />
              </svg>
              <span>Budget Smart Tier (Tested OEM)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6 }}>
              <li>High-utility unbranded or OEM electronic components for technicians, DIYers, and workshops.</li>
              <li>Bench-tested at Nawabpur Complex test benches for voltage ripple, thermal load, and safety.</li>
              <li>Zero counterfeit branding — accurately described without fake manufacturer logos.</li>
              <li>Backed by NCAMart 3–6 month direct replacement warranty.</li>
            </ul>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
