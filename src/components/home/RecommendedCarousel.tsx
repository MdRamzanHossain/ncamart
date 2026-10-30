"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { formatPaisa } from "@/lib/money";

interface ProductCardData {
  id: string;
  slug: string;
  titleEn: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  pricePaisa: number;
  mrpPaisa: number;
  rating: number;
  reviewsCount: number;
  icon: string;
  stageBg: string;
}

const RECOMMENDED_PRODUCTS: ProductCardData[] = [
  {
    id: "p1",
    slug: "baseus-65w-gan-ultra-fast-charger",
    titleEn: "Baseus GaN5 Pro 65W Fast Charger",
    tier: "AUTHENTIC",
    pricePaisa: 345000,
    mrpPaisa: 395000,
    rating: 4.8,
    reviewsCount: 42,
    icon: "⚡",
    stageBg: "linear-gradient(145deg, #eef2ff 0%, #e0e7ff 100%)",
  },
  {
    id: "p2",
    slug: "mechanic-t12-pro-smart-soldering-station",
    titleEn: "Mechanic T12 Pro Smart Soldering Station",
    tier: "AUTHENTIC",
    pricePaisa: 480000,
    mrpPaisa: 550000,
    rating: 4.9,
    reviewsCount: 64,
    icon: "🔥",
    stageBg: "linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%)",
  },
  {
    id: "p3",
    slug: "oem-t12-replacement-iron-tips-set-5pcs",
    titleEn: "T12 Precision Soldering Iron Tips (5-Pack)",
    tier: "BUDGET_SMART",
    pricePaisa: 125000,
    mrpPaisa: 160000,
    rating: 4.7,
    reviewsCount: 29,
    icon: "🛠️",
    stageBg: "linear-gradient(145deg, #f0fdf4 0%, #ccfbf1 100%)",
  },
  {
    id: "p4",
    slug: "ugreen-100w-usb-c-braided-cable-2m",
    titleEn: "UGREEN 100W Braided E-Marker Cable (2m)",
    tier: "AUTHENTIC",
    pricePaisa: 115000,
    mrpPaisa: 140000,
    rating: 4.8,
    reviewsCount: 51,
    icon: "🔌",
    stageBg: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)",
  },
  {
    id: "p5",
    slug: "fluke-101-digital-multimeter-pocket",
    titleEn: "Fluke 101 Pocket Digital Multimeter",
    tier: "AUTHENTIC",
    pricePaisa: 495000,
    mrpPaisa: 560000,
    rating: 4.9,
    reviewsCount: 37,
    icon: "🔬",
    stageBg: "linear-gradient(145deg, #faf5ff 0%, #f3e8ff 100%)",
  },
  {
    id: "p6",
    slug: "oem-usb-c-pd-trigger-tester-board",
    titleEn: "USB-C PD Trigger & Load Tester Module",
    tier: "BUDGET_SMART",
    pricePaisa: 145000,
    mrpPaisa: 185000,
    rating: 4.6,
    reviewsCount: 19,
    icon: "💡",
    stageBg: "linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 100%)",
  },
];

export function RecommendedCarousel() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [wishlistState, setWishlistState] = useState<Record<string, boolean>>({});

  const toggleWishlist = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlistState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -280, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 280, behavior: "smooth" });
    }
  };

  return (
    <section
      aria-label="Recommended Hardware For You"
      style={{
        padding: "8px 24px 28px",
        maxWidth: "1320px",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Section Header with Integrated Carousel Controls */}
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
              color: "#d97706",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "3px",
            }}
          >
            DUAL-TIER VERIFIED PICKS
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
            Recommended For You
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={scrollLeft}
            aria-label="Previous recommended products"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "800",
              boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={scrollRight}
            aria-label="Next recommended products"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "800",
              boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
            }}
          >
            ›
          </button>
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
          >
            <span>See All</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* Product Cards Grid / Horizontal Carousel */}
      <div
        ref={scrollContainerRef}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(195px, 1fr))",
          gap: "16px",
          overflowX: "auto",
          paddingBottom: "8px",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {RECOMMENDED_PRODUCTS.map((prod) => {
          const isWishlisted = !!wishlistState[prod.id];
          const isAuthentic = prod.tier === "AUTHENTIC";

          return (
            <Link
              key={prod.id}
              href={`/products/${prod.slug}`}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
                padding: "12px",
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              className="interactive-scale"
            >
              <div>
                {/* Pastel Product Stage */}
                <div
                  style={{
                    height: "136px",
                    borderRadius: "14px",
                    background: prod.stageBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "50px",
                    position: "relative",
                    marginBottom: "10px",
                  }}
                >
                  <span>{prod.icon}</span>

                  {/* Dual-Tier Badge at Top Left */}
                  <span
                    style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      fontSize: "9.5px",
                      fontWeight: "800",
                      padding: "2px 7px",
                      borderRadius: "9999px",
                      backgroundColor: isAuthentic ? "#fef3c7" : "#ccfbf1",
                      color: isAuthentic ? "#92400e" : "#0f766e",
                      border: isAuthentic ? "1px solid #fcd34d" : "1px solid #5eead4",
                    }}
                  >
                    {isAuthentic ? "✨ Authentic" : "⚡ Budget OEM"}
                  </span>

                  {/* Subtle Heart Icon at Top Right */}
                  <button
                    type="button"
                    onClick={(e) => toggleWishlist(prod.id, e)}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      border: "1px solid rgba(15, 23, 42, 0.08)",
                      color: isWishlisted ? "#ef4444" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    {isWishlisted ? "♥" : "♡"}
                  </button>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#0f172a",
                    lineHeight: "1.35",
                    margin: "0 0 6px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: "35px",
                  }}
                >
                  {prod.titleEn}
                </h3>

                {/* Rating Row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    color: "#64748b",
                    marginBottom: "10px",
                  }}
                >
                  <span style={{ color: "#f59e0b", fontWeight: "800" }}>★</span>
                  <span style={{ fontWeight: "700", color: "#334155" }}>{prod.rating.toFixed(1)}</span>
                  <span>({prod.reviewsCount})</span>
                </div>
              </div>

              {/* Bottom Row: Price on Left + Action Pill on Right */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: "8px",
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "14.5px",
                      fontWeight: "800",
                      color: "#0f172a",
                    }}
                  >
                    ৳{formatPaisa(prod.pricePaisa)}
                  </div>
                  <div
                    style={{
                      fontSize: "10.5px",
                      color: "#94a3b8",
                      textDecoration: "line-through",
                    }}
                  >
                    ৳{formatPaisa(prod.mrpPaisa)}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#2563eb",
                    backgroundColor: "#eff6ff",
                    padding: "5px 10px",
                    borderRadius: "8px",
                  }}
                >
                  View →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
