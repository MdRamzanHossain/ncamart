"use client";

import React, { useState } from "react";
import Link from "next/link";

interface CollectionCard {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  borderColor: string;
  icons: string[];
  link: string;
  items: string[];
}

const COLLECTIONS: CollectionCard[] = [
  {
    id: "tech-essentials",
    title: "Tech Essentials",
    subtitle: "Upgrade Your World",
    gradient: "linear-gradient(135deg, #c7d2fe 0%, #e0e7ff 55%, #dbeafe 100%)",
    borderColor: "rgba(129, 140, 248, 0.35)",
    icons: ["⌚", "🎧", "⚡"],
    link: "/catalog?category=tech-essentials",
    items: ["Thunderbolt 4 Docks", "USB-C 100W GaN", "Braided Kevlar Cables", "Magnetic Powerbanks"],
  },
  {
    id: "bench-soldering",
    title: "Bench & Soldering",
    subtitle: "100% Authentic Picks",
    gradient: "linear-gradient(135deg, #f9a8d4 0%, #fbcfe8 55%, #fce7f3 100%)",
    borderColor: "rgba(244, 114, 182, 0.35)",
    icons: ["🔥", "🔬", "🛠️"],
    link: "/catalog?tier=AUTHENTIC&category=engineering-tools",
    items: ["Mechanic T12 Pro", "Hakko Soldering Tips", "Kaisi Microscope 4K", "Relife Solder Paste"],
  },
  {
    id: "nawabpur-sourced",
    title: "Nawabpur Sourced",
    subtitle: "Same-Day Drop & Pack",
    gradient: "linear-gradient(135deg, #fed7aa 0%, #ffedd5 55%, #fef3c7 100%)",
    borderColor: "rgba(251, 146, 60, 0.35)",
    icons: ["📦", "🔌", "🔋"],
    link: "/catalog?fulfillment=REGULAR_DROP_PACK",
    items: ["Wholesale DC Jacks", "Fluke Multimeters", "Heat-Shrink Tubing", "Banana Plug Leads"],
  },
  {
    id: "preorder-direct",
    title: "Pre-Order Direct",
    subtitle: "Direct Air-Freight Gear",
    gradient: "linear-gradient(135deg, #d8b4fe 0%, #e9d5ff 50%, #dbeafe 100%)",
    borderColor: "rgba(168, 85, 247, 0.35)",
    icons: ["✈️", "📡", "💻"],
    link: "/pre-orders",
    items: ["Siglent Oscilloscope", "Thermal Imaging Cams", "SMD Rework Stations", "High-Voltage Probes"],
  },
];

export function CollectionsGrid() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const toggleCard = (id: string) => {
    setExpandedCard((prev) => (prev === id ? null : id));
  };

  return (
    <section
      aria-label="Featured Collections"
      style={{
        padding: "20px 20px 12px",
        maxWidth: "1340px",
        margin: "0 auto",
      }}
    >
      {/* Section Header matching Reference Design */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "800",
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Interactive Collections
        </h2>

        <Link
          href="/catalog"
          style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "#2563eb",
            textDecoration: "none",
          }}
          className="interactive-scale"
        >
          View All
        </Link>
      </div>

      {/* 4-Card Pastel Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: "18px",
        }}
      >
        {COLLECTIONS.map((col) => {
          const isExpanded = expandedCard === col.id;

          return (
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
                minHeight: isExpanded ? "260px" : "200px",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
                transition: "all var(--duration-normal) var(--ease-spring)",
                cursor: "pointer",
              }}
              onClick={() => toggleCard(col.id)}
            >
              {/* Top-Left Title & Subtitle */}
              <div style={{ position: "relative", zIndex: 2 }}>
                <h3
                  style={{
                    fontSize: "17px",
                    fontWeight: "800",
                    color: "#0f172a",
                    margin: "0 0 2px",
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
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: "10px",
                  marginTop: "14px",
                  marginBottom: isExpanded ? "10px" : "4px",
                  transform: isExpanded ? "scale(1.06)" : "scale(1)",
                  transition: "transform var(--duration-fast) ease",
                }}
              >
                {col.icons.map((ic, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: idx === 1 ? "64px" : "52px",
                      height: idx === 1 ? "64px" : "52px",
                      borderRadius: "16px",
                      backgroundColor: "rgba(255, 255, 255, 0.65)",
                      backdropFilter: "blur(6px)",
                      border: "1px solid rgba(255, 255, 255, 0.85)",
                      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: idx === 1 ? "32px" : "24px",
                    }}
                  >
                    {ic}
                  </div>
                ))}
              </div>

              {/* Expanded Quick Filter Pills */}
              {isExpanded && (
                <div
                  style={{
                    margin: "8px 0 32px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    position: "relative",
                    zIndex: 3,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {col.items.map((item) => (
                    <Link
                      key={item}
                      href={`/catalog?q=${encodeURIComponent(item)}`}
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "4px 9px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(255, 255, 255, 0.85)",
                        color: "#0f172a",
                        textDecoration: "none",
                        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.06)",
                      }}
                    >
                      {item}
                    </Link>
                  ))}
                </div>
              )}

              {/* Bottom-Right White Circular Chevron Button (matching Reference) */}
              <Link
                href={col.link}
                aria-label={`Browse ${col.title}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  bottom: "14px",
                  right: "14px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
                  textDecoration: "none",
                  fontSize: "15px",
                  fontWeight: "800",
                  zIndex: 4,
                }}
              >
                ›
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

