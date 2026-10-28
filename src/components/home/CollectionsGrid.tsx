"use client";

import React, { useState } from "react";
import Link from "next/link";

interface CollectionCard {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  gradient: string;
  accentColor: string;
  borderColor: string;
  icon: string;
  link: string;
  items: string[];
}

const COLLECTIONS: CollectionCard[] = [
  {
    id: "tech-essentials",
    tag: "CURATED HUB",
    title: "Tech Essentials",
    subtitle: "Upgrade Your World",
    gradient: "linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.12) 100%)",
    accentColor: "#818cf8",
    borderColor: "rgba(129, 140, 248, 0.3)",
    icon: "💻",
    link: "/catalog?category=tech-essentials",
    items: ["Thunderbolt 4 Docks", "USB-C 100W GaN", "Braided Kevlar Cables", "Magnetic Powerbanks"],
  },
  {
    id: "bench-soldering",
    tag: "DISTRIBUTOR DIRECT",
    title: "Bench & Soldering",
    subtitle: "100% Distributor Authentic",
    gradient: "linear-gradient(135deg, rgba(244, 63, 94, 0.22) 0%, rgba(251, 113, 133, 0.12) 100%)",
    accentColor: "#fb7185",
    borderColor: "rgba(251, 113, 133, 0.3)",
    icon: "🔥",
    link: "/catalog?tier=AUTHENTIC&category=engineering-tools",
    items: ["Mechanic T12 Pro", "Hakko Soldering Tips", "Kaisi Microscope 4K", "Relife Solder Paste"],
  },
  {
    id: "nawabpur-sourced",
    tag: "SAME-DAY RUNNER",
    title: "Nawabpur Sourced",
    subtitle: "Drop-and-Pack Stalls",
    gradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.12) 100%)",
    accentColor: "var(--tier-authentic-gold)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    icon: "📦",
    link: "/catalog?fulfillment=REGULAR_DROP_PACK",
    items: ["Wholesale DC Jacks", "Fluke Multimeters", "Heat-Shrink Tubing", "Banana Plug Leads"],
  },
  {
    id: "preorder-direct",
    tag: "NICHE IMPORTS",
    title: "Pre-Order Direct",
    subtitle: "Niche Import Engineering Tools",
    gradient: "linear-gradient(135deg, rgba(14, 165, 233, 0.22) 0%, rgba(56, 189, 248, 0.12) 100%)",
    accentColor: "#38bdf8",
    borderColor: "rgba(56, 189, 248, 0.3)",
    icon: "✈️",
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
        padding: "var(--space-2xl) var(--space-md)",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "var(--space-xl)",
          flexWrap: "wrap",
          gap: "var(--space-md)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--tier-authentic-gold)",
              fontWeight: "var(--font-weight-bold)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "4px",
            }}
          >
            DISCOVER SPECIALIZED HARDWARE
          </div>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
              fontWeight: "800",
              color: "var(--text-primary)",
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            Interactive Collections
          </h2>
        </div>

        <Link
          href="/catalog"
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--tier-authentic-gold)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
          className="interactive-scale"
        >
          <span>View All 890+ SKUs</span>
          <span>→</span>
        </Link>
      </div>

      {/* 4-Card Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: "var(--space-lg)",
        }}
      >
        {COLLECTIONS.map((col) => {
          const isExpanded = expandedCard === col.id;

          return (
            <div
              key={col.id}
              style={{
                borderRadius: "var(--radius-xl)",
                background: col.gradient,
                border: `1px solid ${col.borderColor}`,
                padding: "var(--space-xl)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: isExpanded ? "340px" : "260px",
                position: "relative",
                overflow: "hidden",
                boxShadow: isExpanded
                  ? `0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px ${col.accentColor}33`
                  : "0 8px 24px rgba(0, 0, 0, 0.2)",
                transition: "all var(--duration-normal) var(--ease-spring)",
                cursor: "pointer",
              }}
              onClick={() => toggleCard(col.id)}
            >
              {/* Floating Background Icon */}
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  fontSize: "56px",
                  opacity: 0.18,
                  userSelect: "none",
                  transform: isExpanded ? "scale(1.2) rotate(-8deg)" : "scale(1)",
                  transition: "transform var(--duration-fast) ease",
                }}
              >
                {col.icon}
              </div>

              {/* Card Top Information */}
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: "800",
                    color: col.accentColor,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {col.tag}
                </span>

                <h3
                  style={{
                    fontSize: "var(--font-size-xl)",
                    fontWeight: "800",
                    color: "var(--text-primary)",
                    margin: "6px 0 2px",
                  }}
                >
                  {col.title}
                </h3>

                <p
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  {col.subtitle}
                </p>
              </div>

              {/* Expanded Item Pills Preview */}
              {isExpanded && (
                <div
                  style={{
                    margin: "var(--space-md) 0",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    animation: "fadeIn var(--duration-fast) ease-out",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {col.items.map((item) => (
                    <Link
                      key={item}
                      href={`/catalog?q=${encodeURIComponent(item)}`}
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        padding: "4px 8px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "rgba(0, 0, 0, 0.35)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "var(--text-primary)",
                        textDecoration: "none",
                      }}
                    >
                      {item}
                    </Link>
                  ))}
                </div>
              )}

              {/* Bottom Action: Arrow Button & Direct Catalog Link */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "var(--space-md)",
                }}
              >
                <Link
                  href={col.link}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: "var(--font-size-xs)",
                    fontWeight: "700",
                    color: col.accentColor,
                    textDecoration: "none",
                  }}
                >
                  Browse Collection →
                </Link>

                {/* Circular Expansion Toggle Button */}
                <button
                  type="button"
                  aria-label={`Expand ${col.title} details`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCard(col.id);
                  }}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    border: `1.5px solid ${col.borderColor}`,
                    color: col.accentColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "transform var(--duration-fast) ease",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                >
                  ➔
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
