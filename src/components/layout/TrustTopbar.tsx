"use client";

import React from "react";
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";

export function TrustTopbar() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className="topbar-root"
      style={{
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        fontSize: "12px",
        color: "#475569",
        padding: "7px 24px",
      }}
    >
      <div
        style={{
          maxWidth: "1320px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Physical Showroom Location */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.2"
            style={{ flexShrink: 0 }}
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="topbar-location-text" style={{ fontWeight: "500", color: "#334155" }}>
            {locale === "bn"
              ? "দোকান ৪২, নবাবপুর কমপ্লেক্স, সুন্দরবন স্কোয়ার, ঢাকা"
              : "Shop 42, Nawabpur Complex, Sundarban Square, Dhaka"}
          </span>
        </div>

        {/* Trust Metrics Ticker */}
        <div
          className="topbar-metrics-ticker"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: "#d97706", fontWeight: "800" }}>★</span>
            <span style={{ fontWeight: "500" }}>
              {locale === "bn"
                ? "১০০% ধ্বংসযোগ্য হলোগ্রাফিক সিল"
                : "100% Destructive Holographic Seals"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: "#0d9488", fontWeight: "800" }}>✓</span>
            <span style={{ fontWeight: "500" }}>
              {locale === "bn"
                ? "অফিসিয়াল ডিস্ট্রিবিউটর ওয়ারেন্টি"
                : "Official Distributor Warranty"}
            </span>
          </div>
        </div>

        {/* Right Controls: Quick Links, Currency & Language Switcher */}
        <div className="topbar-right-controls" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link
            href="/track"
            className="hide-on-mobile"
            style={{
              color: "#334155",
              fontWeight: "600",
              textDecoration: "none",
              fontSize: "11.5px",
            }}
          >
            {locale === "bn" ? "অর্ডার ট্র্যাক" : "Track Order"}
          </Link>

          <span className="hide-on-mobile" style={{ color: "#cbd5e1" }}>|</span>

          {/* Currency Indicator */}
          <span
            style={{
              fontFamily: "var(--font-family-mono)",
              fontWeight: "700",
              color: "#0f172a",
              fontSize: "11.5px",
            }}
          >
            BDT (৳)
          </span>

          {/* Language Switcher */}
          <div
            role="group"
            aria-label="Language selection"
            style={{
              display: "inline-flex",
              backgroundColor: "#f1f5f9",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              padding: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => setLocale("bn")}
              aria-pressed={locale === "bn"}
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                backgroundColor: locale === "bn" ? "#2563eb" : "transparent",
                color: locale === "bn" ? "#ffffff" : "#475569",
                fontWeight: "700",
                fontSize: "10.5px",
                cursor: "pointer",
              }}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              aria-pressed={locale === "en"}
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                backgroundColor: locale === "en" ? "#2563eb" : "transparent",
                color: locale === "en" ? "#ffffff" : "#475569",
                fontWeight: "700",
                fontSize: "10.5px",
                cursor: "pointer",
              }}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
