"use client";

import React from "react";
import { ThemeToggle } from "@/lib/theme";
import { useLocale } from "@/context/LocaleContext";

export function TrustTopbar() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className="topbar-root"
      style={{
        backgroundColor: "var(--bg-canvas)",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: "var(--font-size-2xs)",
        color: "var(--text-secondary)",
        padding: "var(--space-2xs) var(--space-xl)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--space-sm)",
      }}
    >
      {/* Physical Showroom Location */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", minWidth: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="topbar-location-text">
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
          gap: "var(--space-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2xs)" }}>
          <span style={{ color: "var(--tier-authentic-gold)", fontWeight: "var(--font-weight-bold)" }}>★</span>
          <span>
            {locale === "bn"
              ? "১০০% ধ্বংসযোগ্য হলোগ্রাফিক সিল"
              : "100% Destructive Holographic Seals"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2xs)" }}>
          <span style={{ color: "var(--tier-budget-teal)", fontWeight: "var(--font-weight-bold)" }}>✓</span>
          <span>
            {locale === "bn"
              ? "অফিসিয়াল ডিস্ট্রিবিউটর ওয়ারেন্টি"
              : "Official Distributor Warranty"}
          </span>
        </div>
      </div>

      {/* Right Controls: Currency & Language Switcher & Theme */}
      <div className="topbar-right-controls" style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
        {/* Currency Indicator */}
        <span
          style={{
            fontFamily: "var(--font-family-mono)",
            fontWeight: "var(--font-weight-semibold)",
            color: "var(--text-primary)",
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
            backgroundColor: "var(--bg-surface-elevated)",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--border-default)",
            padding: "1px",
          }}
        >
          <button
            type="button"
            onClick={() => setLocale("bn")}
            aria-pressed={locale === "bn"}
            style={{
              padding: "2px 6px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: locale === "bn" ? "var(--color-brand-primary)" : "transparent",
              color: locale === "bn" ? "#ffffff" : "var(--text-tertiary)",
              fontWeight: "var(--font-weight-bold)",
              fontSize: "10px",
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
              padding: "2px 6px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: locale === "en" ? "var(--color-brand-primary)" : "transparent",
              color: locale === "en" ? "#ffffff" : "var(--text-tertiary)",
              fontWeight: "var(--font-weight-bold)",
              fontSize: "10px",
              cursor: "pointer",
            }}
          >
            EN
          </button>
        </div>

        <ThemeToggle />
      </div>
    </div>
  );
}
