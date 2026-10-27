"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatPaisa } from "@/lib/money";

interface RankedProduct {
  rank: number;
  slug: string;
  title: string;
  category: string;
  pricePaisa: number;
  rating: number;
  reviews: number;
  rankBadgeColor: string;
  icon: string;
}

const RANKED_ITEMS: RankedProduct[] = [
  {
    rank: 1,
    slug: "mechanic-t12-pro-smart-soldering-station",
    title: "Mechanic T12 Pro Smart Soldering Station 72W",
    category: "Bench Tools",
    pricePaisa: 480000,
    rating: 4.9,
    reviews: 312,
    rankBadgeColor: "#3b82f6", // 1 in blue
    icon: "🔥",
  },
  {
    rank: 2,
    slug: "anker-737-power-bank-24000mah-140w",
    title: "Anker 737 GaN 140W PowerCore 24K",
    category: "GaN Fast Power",
    pricePaisa: 1125000,
    rating: 4.9,
    reviews: 245,
    rankBadgeColor: "#64748b", // 2 in slate
    icon: "⚡",
  },
  {
    rank: 3,
    slug: "ugreen-100w-usb-c-braided-cable-2m",
    title: "UGREEN 100W USB-C E-Marker Kevlar Cable",
    category: "Cables & Bus",
    pricePaisa: 115000,
    rating: 4.8,
    reviews: 189,
    rankBadgeColor: "#78716c", // 3 in neutral
    icon: "🔌",
  },
];

export function TrendingLeaderboard() {
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
      }}
    >
      <div>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "16px" }}>📈</span>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: "800",
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Trending Now
            </span>
          </div>

          <Link
            href="/catalog?sort=POPULAR"
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "var(--tier-authentic-gold)",
              textDecoration: "none",
            }}
          >
            See All →
          </Link>
        </div>

        {/* Ranked Items List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {RANKED_ITEMS.map((item) => {
            const isHovered = hoveredRank === item.rank;

            return (
              <Link
                key={item.rank}
                href={`/products/${item.slug}`}
                onMouseEnter={() => setHoveredRank(item.rank)}
                onMouseLeave={() => setHoveredRank(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                  padding: "10px",
                  borderRadius: "var(--radius-lg)",
                  backgroundColor: isHovered ? "var(--bg-surface-elevated)" : "transparent",
                  border: "1px solid",
                  borderColor: isHovered ? "var(--border-default)" : "transparent",
                  textDecoration: "none",
                  transform: isHovered ? "translateX(4px)" : "translateX(0)",
                  transition: "all var(--duration-fast) var(--ease-spring)",
                }}
              >
                {/* Number Badge */}
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: item.rankBadgeColor,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "900",
                    fontSize: "12px",
                    flexShrink: 0,
                    boxShadow: `0 2px 8px ${item.rankBadgeColor}66`,
                  }}
                >
                  #{item.rank}
                </div>

                {/* Compact Product Icon/Thumb */}
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-canvas)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "700",
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <span style={{ fontSize: "10px", color: "var(--tier-authentic-gold)" }}>
                      ★ {item.rating}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                      ({item.reviews})
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div
                  style={{
                    fontFamily: "var(--font-family-mono)",
                    fontSize: "var(--font-size-xs)",
                    fontWeight: "800",
                    color: "var(--tier-authentic-gold)",
                    flexShrink: 0,
                  }}
                >
                  ৳{formatPaisa(item.pricePaisa)}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer Stat */}
      <div
        style={{
          marginTop: "var(--space-md)",
          paddingTop: "var(--space-sm)",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "10px",
          color: "var(--text-tertiary)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Updated Every 60 Mins</span>
        <span>Real-Time Nawabpur Volume</span>
      </div>
    </div>
  );
}
