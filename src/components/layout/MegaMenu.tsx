"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { AuthenticBadge, BudgetSmartBadge } from "@/components/ui/badge";

export interface CategoryItem {
  id: string;
  slug: string;
  titleEn: string;
  titleBn: string;
  description: string;
  authenticCount: number;
  budgetCount: number;
  subcategories: Array<{ name: string; slug: string }>;
}

const CATEGORIES: [CategoryItem, ...CategoryItem[]] = [
  {
    id: "cat-chargers",
    slug: "chargers-gan-adapters",
    titleEn: "High-Power Chargers & GaN Adapters",
    titleBn: "হাই-পাওয়ার চার্জার ও গ্যান অ্যাডাপ্টার",
    description: "65W, 100W, 140W GaN fast chargers with dual-tier authentic certification.",
    authenticCount: 48,
    budgetCount: 32,
    subcategories: [
      { name: "65W GaN Chargers", slug: "65w-gan" },
      { name: "100W–140W Multi-Port Desktop", slug: "100w-140w" },
      { name: "PD 3.1 USB-C Power Supplies", slug: "pd-3-1" },
      { name: "MagSafe & Qi2 Wireless Docks", slug: "wireless-docks" },
    ],
  },
  {
    id: "cat-engineering",
    slug: "engineering-soldering-tools",
    titleEn: "Engineering & Soldering Tools",
    titleBn: "ইঞ্জিনিয়ারিং ও শোল্ডারিং টুলস",
    description: "Precision bench instruments, digital multimeters, hot-air rework stations.",
    authenticCount: 36,
    budgetCount: 54,
    subcategories: [
      { name: "T12 / TS101 Intelligent Soldering Irons", slug: "soldering-irons" },
      { name: "Digital Multimeters & Oscilloscopes", slug: "multimeters" },
      { name: "DC Variable Bench Power Supplies", slug: "bench-power" },
      { name: "Microscope & BGA Rework Stencils", slug: "rework-stencils" },
    ],
  },
  {
    id: "cat-cables",
    slug: "industrial-utility-cables",
    titleEn: "Industrial Utility Cables & Converters",
    titleBn: "ইউটিলিটি কেবলস ও কনভার্টারস",
    description: "Braided 240W braided silicone, Thunderbolt 4, and optical HDMI cables.",
    authenticCount: 65,
    budgetCount: 42,
    subcategories: [
      { name: "240W USB-C E-Marker Cables", slug: "240w-type-c" },
      { name: "Thunderbolt 4 / USB4 40Gbps", slug: "thunderbolt-4" },
      { name: "Optical 8K HDMI 2.1 Cables", slug: "hdmi-2-1" },
      { name: "Industrial USB-to-RS485/UART", slug: "industrial-serial" },
    ],
  },
  {
    id: "cat-wearables",
    slug: "smart-wearables-audio",
    titleEn: "Smart Wearables & Premium Audio",
    titleBn: "ওয়্যারলেস অডিও ও স্মার্ট গ্যাজেটস",
    description: "Hi-Res LDAC earphones, Smartwatches with AMOLED, and noise-cancelling mics.",
    authenticCount: 29,
    budgetCount: 40,
    subcategories: [
      { name: "Hi-Res LDAC / ANC TWS Earbuds", slug: "anc-earbuds" },
      { name: "AMOLED Smartwatches with GPS", slug: "smartwatches" },
      { name: "Condenser / Wireless Lapel Microphones", slug: "microphones" },
      { name: "DAC Amplifiers & Studio Monitors", slug: "dac-amps" },
    ],
  },
  {
    id: "cat-surveillance",
    slug: "cctv-surveillance-iot",
    titleEn: "CCTV, Surveillance & Smart IoT",
    titleBn: "সিসিটিভি ও সিকিউরিটি সিস্টেম",
    description: "POE IP cameras, NVR recorders, solar outdoor security solutions.",
    authenticCount: 22,
    budgetCount: 35,
    subcategories: [
      { name: "ColorVu / Night-Color POE Cameras", slug: "poe-cameras" },
      { name: "Dual-Lens Solar 4G Outdoor Security", slug: "solar-cameras" },
      { name: "8CH / 16CH 4K Network Video Recorders", slug: "nvr-recorders" },
      { name: "Smart Door Locks with Fingerprint & App", slug: "smart-locks" },
    ],
  },
];

export function MegaMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryItem>(CATEGORIES[0]);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div
      ref={menuRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: "relative" }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 6px",
          borderRadius: "var(--radius-sm)",
          color: isOpen ? "#ff5e62" : "rgba(255, 255, 255, 0.82)",
          fontWeight: "500",
          fontSize: "13px",
          transition: "color var(--duration-fast) ease",
          cursor: "pointer",
        }}
      >
        <span>Categories</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--duration-fast) var(--ease-spring)",
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Mega Dropdown Panel */}
      {isOpen && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 850,
            width: "840px",
            maxWidth: "90vw",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-xl)",
            backdropFilter: "var(--glass-blur-lg)",
            WebkitBackdropFilter: "var(--glass-blur-lg)",
            display: "grid",
            gridTemplateColumns: "320px 1fr",
            overflow: "hidden",
            animation: "scaleIn 0.2s var(--ease-spring)",
          }}
        >
          {/* Category List Column */}
          <div
            style={{
              backgroundColor: "var(--bg-surface-elevated)",
              borderRight: "1px solid var(--border-subtle)",
              padding: "var(--space-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2xs)",
            }}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onMouseEnter={() => setActiveCategory(cat)}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "2px",
                    padding: "var(--space-sm) var(--space-md)",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: isSelected ? "var(--bg-surface-active)" : "transparent",
                    color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all var(--duration-fast) ease",
                  }}
                >
                  <span style={{ fontWeight: isSelected ? "var(--font-weight-bold)" : "var(--font-weight-medium)", fontSize: "var(--font-size-sm)" }}>
                    {cat.titleEn}
                  </span>
                  <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--text-tertiary)" }}>
                    {cat.titleBn}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Category Details & Subcategories */}
          <div
            style={{
              padding: "var(--space-xl)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
                <AuthenticBadge size="sm" pulse={false} />
                <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--text-tertiary)" }}>
                  {activeCategory.authenticCount} Authentic
                </span>
                <BudgetSmartBadge size="sm" pulse={false} />
                <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--text-tertiary)" }}>
                  {activeCategory.budgetCount} Tested OEM
                </span>
              </div>

              <h4 style={{ fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-bold)", color: "var(--text-primary)" }}>
                {activeCategory.titleEn}
              </h4>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: "var(--space-2xs)", marginBottom: "var(--space-lg)" }}>
                {activeCategory.description}
              </p>

              {/* Subcategories Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                {activeCategory.subcategories.map((sub) => (
                  <Link
                    key={sub.slug}
                    href={`/catalog/${activeCategory.slug}/${sub.slug}`}
                    onClick={() => setIsOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-xs)",
                      fontSize: "var(--font-size-sm)",
                      color: "var(--text-secondary)",
                      padding: "var(--space-xs) 0",
                      transition: "color var(--duration-fast) ease",
                    }}
                    className="interactive-scale"
                  >
                    <span style={{ color: "var(--color-brand-primary)" }}>→</span>
                    <span>{sub.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Bottom View All Link */}
            <div style={{ paddingTop: "var(--space-lg)", borderTop: "1px solid var(--border-subtle)", marginTop: "var(--space-lg)" }}>
              <Link
                href={`/catalog/${activeCategory.slug}`}
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: "var(--font-size-xs)",
                  fontWeight: "var(--font-weight-bold)",
                  color: "var(--color-brand-primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-2xs)",
                }}
              >
                Browse all {activeCategory.titleEn} ({activeCategory.authenticCount + activeCategory.budgetCount} products) →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
