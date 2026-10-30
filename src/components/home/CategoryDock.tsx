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
  { id: "electronics", name: "Audio & DACs", icon: "🎧", slug: "audio-dacs", tint: "#eff6ff" },
  { id: "gan", name: "GaN & Power", icon: "⚡", slug: "chargers-power", tint: "#fdf2f8" },
  { id: "scopes", name: "Bench & Lab", icon: "🔬", slug: "scopes-test", tint: "#ecfeff" },
  { id: "cables", name: "Cables & Hubs", icon: "🔌", slug: "cables-adapters", tint: "#f5f3ff" },
  { id: "cctv", name: "CCTV & IoT", icon: "📹", slug: "cctv-surveillance", tint: "#f0f9ff" },
  { id: "wearables", name: "Wearables", icon: "⌚", slug: "smart-wearables", tint: "#fffbeb" },
  { id: "all", name: "All Catalog", icon: "⊞", slug: "catalog", tint: "#eef2ff" },
];

export function CategoryDock() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section
      aria-label="Popular Categories Dock"
      style={{
        padding: "0 24px",
        maxWidth: "1320px",
        margin: "-44px auto 28px",
        position: "relative",
        zIndex: 25,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "22px",
          padding: "22px 28px",
          boxShadow: "0 16px 38px rgba(15, 23, 42, 0.08)",
          border: "1px solid #e2e8f0",
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
                transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                transform: isHovered ? "translateY(-4px)" : "translateY(0)",
              }}
            >
              {/* Circular Pastel Icon Bubble */}
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: cat.tint,
                  border: isHovered ? "2px solid #2563eb" : "1px solid rgba(15, 23, 42, 0.07)",
                  boxShadow: isHovered
                    ? "0 8px 20px rgba(37, 99, 235, 0.18)"
                    : "0 4px 10px rgba(15, 23, 42, 0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isMore ? "24px" : "27px",
                  color: isMore ? "#2563eb" : "#0f172a",
                  fontWeight: isMore ? "900" : "400",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{cat.icon}</span>
              </div>

              {/* Clean Category Label */}
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: "700",
                  color: isHovered ? "#2563eb" : "#1e293b",
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
