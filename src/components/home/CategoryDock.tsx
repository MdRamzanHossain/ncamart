"use client";

import React, { useState } from "react";
import Link from "next/link";

interface CategoryDockItem {
  id: string;
  name: string;
  icon: string;
  slug: string;
  tint: string;
}

const CATEGORIES: CategoryDockItem[] = [
  { id: "tools", name: "Tools & Meters", icon: "🛠️", slug: "engineering-tools", tint: "#fff1f2" },
  { id: "electronics", name: "Electronics", icon: "🎧", slug: "audio-dacs", tint: "#eff6ff" },
  { id: "gan", name: "GaN & Power", icon: "⚡", slug: "chargers-power", tint: "#fdf2f8" },
  { id: "scopes", name: "Bench & Lab", icon: "🔬", slug: "scopes-test", tint: "#ecfeff" },
  { id: "cables", name: "Cables & Bus", icon: "🔌", slug: "cables-adapters", tint: "#f5f3ff" },
  { id: "cctv", name: "CCTV & IoT", icon: "📹", slug: "cctv-surveillance", tint: "#f0f9ff" },
  { id: "wearables", name: "Wearables", icon: "⌚", slug: "smart-wearables", tint: "#fffbeb" },
  { id: "all", name: "More", icon: "⊞", slug: "catalog", tint: "#eef2ff" },
];

export function CategoryDock() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section
      aria-label="Popular Categories Dock"
      style={{
        padding: "0 20px",
        maxWidth: "1340px",
        margin: "-44px auto 12px",
        position: "relative",
        zIndex: 25,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "22px",
          padding: "20px 24px",
          boxShadow: "0 14px 36px rgba(15, 23, 42, 0.09)",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          overflowX: "auto",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {CATEGORIES.map((cat) => {
          const isHovered = hoveredId === cat.id;
          const isMore = cat.id === "all";

          return (
            <Link
              key={cat.id}
              href={isMore ? "/catalog" : `/categories/${cat.slug}`}
              onMouseEnter={() => setHoveredId(cat.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                textDecoration: "none",
                minWidth: "96px",
                flex: 1,
                cursor: "pointer",
                transition: "transform var(--duration-fast) var(--ease-spring)",
                transform: isHovered ? "translateY(-4px)" : "translateY(0)",
              }}
            >
              {/* Circular Pastel Icon Bubble */}
              <div
                style={{
                  width: "66px",
                  height: "66px",
                  borderRadius: "50%",
                  backgroundColor: cat.tint,
                  border: isHovered ? "2px solid #6366f1" : "1px solid rgba(15, 23, 42, 0.06)",
                  boxShadow: isHovered
                    ? "0 8px 20px rgba(99, 102, 241, 0.22)"
                    : "0 4px 10px rgba(15, 23, 42, 0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isMore ? "26px" : "28px",
                  color: isMore ? "#6366f1" : "#0f172a",
                  fontWeight: isMore ? "900" : "400",
                  transition: "all var(--duration-fast) ease",
                }}
              >
                <span>{cat.icon}</span>
              </div>

              {/* Clean Category Label */}
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: "600",
                  color: isHovered ? "#4f46e5" : "#1e293b",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                }}
              >
                {cat.name}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

