"use client";

import React, { useState } from "react";
import Link from "next/link";

interface CategoryDockItem {
  id: string;
  name: string;
  icon: string;
  slug: string;
  count: number;
  badge?: string;
}

const CATEGORIES: CategoryDockItem[] = [
  { id: "tools", name: "Tools & Meters", icon: "🛠️", slug: "engineering-tools", count: 230, badge: "Wholesale" },
  { id: "gan", name: "GaN & Power", icon: "⚡", slug: "chargers-power", count: 141, badge: "Fast Ship" },
  { id: "cables", name: "Cables & Bus", icon: "🔌", slug: "cables-adapters", count: 185 },
  { id: "audio", name: "Audio & DACs", icon: "🎧", slug: "audio-dacs", count: 72 },
  { id: "cctv", name: "CCTV & Security", icon: "📹", slug: "cctv-surveillance", count: 120 },
  { id: "wearables", name: "Wearables & Tech", icon: "⌚", slug: "smart-wearables", count: 94 },
  { id: "scopes", name: "Oscilloscopes", icon: "🔬", slug: "scopes-test", count: 48, badge: "Pro Lab" },
  { id: "all", name: "Browse All", icon: "➔", slug: "catalog", count: 890 },
];

export function CategoryDock() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section
      aria-label="Popular Categories Dock"
      style={{
        padding: "var(--space-md) var(--space-md)",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
          overflowX: "auto",
          padding: "var(--space-sm) var(--space-xs) var(--space-md)",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          justifyContent: "flex-start",
        }}
      >
        {CATEGORIES.map((cat) => {
          const isHovered = hoveredId === cat.id;

          return (
            <Link
              key={cat.id}
              href={cat.id === "all" ? "/catalog" : `/categories/${cat.slug}`}
              onMouseEnter={() => setHoveredId(cat.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
                minWidth: "90px",
                position: "relative",
                cursor: "pointer",
                transition: "transform var(--duration-fast) var(--ease-spring)",
                transform: isHovered ? "scale(1.08) translateY(-4px)" : "scale(1)",
              }}
            >
              {/* Circular Icon Container */}
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  backgroundColor: isHovered ? "var(--bg-surface-active)" : "var(--bg-surface-elevated)",
                  border: isHovered ? "2px solid var(--tier-authentic-gold)" : "1.5px solid var(--border-default)",
                  boxShadow: isHovered
                    ? "0 0 16px rgba(245, 158, 11, 0.4), 0 8px 16px rgba(0, 0, 0, 0.3)"
                    : "0 4px 12px rgba(0, 0, 0, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  position: "relative",
                  transition: "all var(--duration-fast) ease",
                }}
              >
                <span>{cat.icon}</span>

                {cat.badge && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-4px",
                      right: "-6px",
                      backgroundColor: "var(--tier-authentic-gold)",
                      color: "#000000",
                      fontSize: "8px",
                      fontWeight: "800",
                      padding: "1px 5px",
                      borderRadius: "var(--radius-full)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {cat.badge}
                  </span>
                )}
              </div>

              {/* Title & Item Count */}
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "var(--font-size-xs)",
                    fontWeight: "var(--font-weight-bold)",
                    color: isHovered ? "var(--tier-authentic-gold)" : "var(--text-primary)",
                    whiteSpace: "nowrap",
                    transition: "color var(--duration-fast) ease",
                  }}
                >
                  {cat.name}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--text-tertiary)",
                    marginTop: "1px",
                  }}
                >
                  {cat.count}+ items
                </div>
              </div>

              {/* Tooltip on Hover */}
              {isHovered && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "-24px",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-xs)",
                    padding: "2px 8px",
                    fontSize: "9px",
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    zIndex: 20,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                    pointerEvents: "none",
                    animation: "fadeIn 0.15s ease-out",
                  }}
                >
                  Explore {cat.name}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
