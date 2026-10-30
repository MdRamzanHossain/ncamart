"use client";

import React from "react";
import Link from "next/link";

interface CollectionCard {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  gradient: string;
  borderColor: string;
  accentColor: string;
  icons: string[];
  link: string;
  items: string[];
}

const COLLECTIONS: CollectionCard[] = [
  {
    id: "tech-essentials",
    badge: "DAILY POWER",
    title: "Tech Essentials",
    subtitle: "GaN Chargers & Braided Cables",
    gradient: "linear-gradient(145deg, #eef2ff 0%, #e0e7ff 55%, #dbeafe 100%)",
    borderColor: "#c7d2fe",
    accentColor: "#3730a3",
    icons: ["⌚", "🎧", "⚡"],
    link: "/catalog?category=chargers-power",
    items: ["Thunderbolt 4 Docks", "USB-C 100W GaN", "Braided Kevlar Cables", "Magnetic Powerbanks"],
  },
  {
    id: "bench-soldering",
    badge: "100% AUTHENTIC",
    title: "Bench & Soldering",
    subtitle: "Hologram Sealed Lab Gear",
    gradient: "linear-gradient(145deg, #fdf2f8 0%, #fce7f3 55%, #ffe4e6 100%)",
    borderColor: "#fbcfe8",
    accentColor: "#9d174d",
    icons: ["🔥", "🔬", "🛠️"],
    link: "/catalog?tier=AUTHENTIC&category=engineering-tools",
    items: ["Mechanic T12 Pro", "Hakko Soldering Tips", "Kaisi Microscope 4K", "Relife Solder Paste"],
  },
  {
    id: "nawabpur-sourced",
    badge: "SAME-DAY SLA",
    title: "Nawabpur Sourced",
    subtitle: "Direct Wholesale Drop & Pack",
    gradient: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 55%, #ffedd5 100%)",
    borderColor: "#fde68a",
    accentColor: "#92400e",
    icons: ["📦", "🔌", "🔋"],
    link: "/catalog?fulfillment=REGULAR_DROP_PACK",
    items: ["Wholesale DC Jacks", "Fluke Multimeters", "Heat-Shrink Tubing", "Banana Plug Leads"],
  },
  {
    id: "preorder-direct",
    badge: "FACTORY AIR-FREIGHT",
    title: "Pre-Order Direct",
    subtitle: "15% Deposit · 7-Day Arrival",
    gradient: "linear-gradient(145deg, #f3e8ff 0%, #e9d5ff 55%, #e0e7ff 100%)",
    borderColor: "#d8b4fe",
    accentColor: "#5b21b6",
    icons: ["✈️", "📡", "💻"],
    link: "/pre-orders",
    items: ["Siglent Oscilloscope", "Thermal Imaging Cams", "SMD Rework Stations", "High-Voltage Probes"],
  },
];

export function CollectionsGrid() {
  return (
    <section
      aria-label="Featured Collections"
      style={{
        padding: "8px 24px 28px",
        maxWidth: "1320px",
        margin: "0 auto",
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "18px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: "800",
              color: "#2563eb",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "3px",
            }}
          >
            CURATED COLLECTIONS
          </div>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: "800",
              color: "#0f172a",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Interactive Collections
          </h2>
        </div>

        <Link
          href="/catalog"
          style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "#2563eb",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 14px",
            borderRadius: "9999px",
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
          }}
          className="interactive-scale"
        >
          <span>View All</span>
          <span>→</span>
        </Link>
      </div>

      {/* 4-Card Pastel Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))",
          gap: "18px",
        }}
      >
        {COLLECTIONS.map((col) => (
          <div
            key={col.id}
            style={{
              borderRadius: "20px",
              background: col.gradient,
              border: `1px solid ${col.borderColor}`,
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "235px",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            {/* Top-Left Title & Subtitle */}
            <div>
              <span
                style={{
                  display: "inline-block",
                  fontSize: "10px",
                  fontWeight: "800",
                  color: col.accentColor,
                  backgroundColor: "rgba(255, 255, 255, 0.75)",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                {col.badge}
              </span>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "800",
                  color: "#0f172a",
                  margin: "0 0 3px",
                  letterSpacing: "-0.02em",
                }}
              >
                {col.title}
              </h3>
              <p
                style={{
                  fontSize: "12.5px",
                  color: "#334155",
                  margin: 0,
                  fontWeight: "500",
                }}
              >
                {col.subtitle}
              </p>
            </div>

            {/* Visual Product Cluster Stage */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: "10px",
                margin: "14px 0",
              }}
            >
              {col.icons.map((ic, idx) => (
                <div
                  key={idx}
                  style={{
                    width: idx === 1 ? "54px" : "46px",
                    height: idx === 1 ? "54px" : "46px",
                    borderRadius: "14px",
                    backgroundColor: "rgba(255, 255, 255, 0.8)",
                    border: "1px solid #ffffff",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: idx === 1 ? "26px" : "22px",
                  }}
                >
                  {ic}
                </div>
              ))}
            </div>

            {/* Quick Sub-Category Filter Pills */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                paddingRight: "38px",
              }}
            >
              {col.items.slice(0, 3).map((item) => (
                <Link
                  key={item}
                  href={`/catalog?q=${encodeURIComponent(item)}`}
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(255, 255, 255, 0.82)",
                    color: "#1e293b",
                    textDecoration: "none",
                    border: "1px solid rgba(255, 255, 255, 0.9)",
                  }}
                >
                  {item}
                </Link>
              ))}
            </div>

            {/* Bottom-Right White Circular Chevron Button */}
            <Link
              href={col.link}
              aria-label={`Browse ${col.title}`}
              style={{
                position: "absolute",
                bottom: "16px",
                right: "16px",
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: "800",
              }}
              className="interactive-scale"
            >
              →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
