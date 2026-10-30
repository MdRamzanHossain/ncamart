"use client";

import React, { useState } from "react";
import Link from "next/link";

interface RankedProduct {
  rank: number;
  slug: string;
  title: string;
  rating: number;
  icon: string;
  badgeColor: string;
}

const RANKED_ITEMS: RankedProduct[] = [
  {
    rank: 1,
    slug: "mechanic-t12-pro-smart-soldering-station",
    title: "Mechanic T12 Pro Smart Soldering Station",
    rating: 4.9,
    icon: "🔥",
    badgeColor: "#f59e0b",
  },
  {
    rank: 2,
    slug: "anker-737-power-bank-24000mah-140w",
    title: "Anker 737 GaN 140W PowerCore 24K",
    rating: 4.8,
    icon: "⚡",
    badgeColor: "#64748b",
  },
  {
    rank: 3,
    slug: "ugreen-100w-usb-c-braided-cable-2m",
    title: "UGREEN 100W USB-C E-Marker Cable",
    rating: 4.7,
    icon: "🔌",
    badgeColor: "#d97706",
  },
];

export function TrendingLeaderboard() {
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "20px",
        padding: "22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <span
          style={{
            fontSize: "17px",
            fontWeight: "800",
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          🔥 Trending Now
        </span>

        <Link
          href="/catalog?sort=POPULAR"
          style={{
            fontSize: "12.5px",
            fontWeight: "700",
            color: "#2563eb",
            textDecoration: "none",
          }}
        >
          See All →
        </Link>
      </div>

      {/* Ranked Items List (1, 2, 3) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, justifyContent: "center" }}>
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
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "14px",
                backgroundColor: isHovered ? "#eff6ff" : "#f8fafc",
                border: isHovered ? "1px solid #bfdbfe" : "1px solid #f1f5f9",
                textDecoration: "none",
                transform: isHovered ? "translateX(3px)" : "translateX(0)",
                transition: "all 0.15s ease",
              }}
            >
              {/* Rank Badge */}
              <span
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "6px",
                  backgroundColor: item.rank === 1 ? "#fef3c7" : "#e2e8f0",
                  color: item.rank === 1 ? "#b45309" : "#334155",
                  fontWeight: "800",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {item.rank}
              </span>

              {/* White Square Product Thumbnail */}
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>

              {/* Title */}
              <div
                style={{
                  flex: 1,
                  fontSize: "12.5px",
                  fontWeight: "700",
                  color: "#0f172a",
                  lineHeight: "1.35",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.title}
              </div>

              {/* Star Rating on Right */}
              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: "700",
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "#f59e0b" }}>★</span>
                <span>{item.rating.toFixed(1)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
