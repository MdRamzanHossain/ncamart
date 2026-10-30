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
  rating: number;
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
    rating: 4.8,
    icon: "🎧",
    stageBg: "linear-gradient(145deg, #e0e7ff 0%, #ede9fe 100%)",
  },
  {
    id: "p2",
    slug: "mechanic-t12-pro-smart-soldering-station",
    titleEn: "Smart Fitness Watch & Bench Meter",
    tier: "AUTHENTIC",
    pricePaisa: 480000,
    rating: 4.9,
    icon: "⌚",
    stageBg: "linear-gradient(145deg, #dbeafe 0%, #e0f2fe 100%)",
  },
  {
    id: "p3",
    slug: "oem-t12-replacement-iron-tips-set-5pcs",
    titleEn: "T12 Precision Soldering Iron Tips",
    tier: "BUDGET_SMART",
    pricePaisa: 125000,
    rating: 4.7,
    icon: "🔥",
    stageBg: "linear-gradient(145deg, #fce7f3 0%, #ffe4e6 100%)",
  },
  {
    id: "p4",
    slug: "ugreen-100w-usb-c-braided-cable-2m",
    titleEn: "UGREEN 100W Braided Desk Cable",
    tier: "AUTHENTIC",
    pricePaisa: 115000,
    rating: 4.6,
    icon: "🔌",
    stageBg: "linear-gradient(145deg, #ffedd5 0%, #fef3c7 100%)",
  },
  {
    id: "p5",
    slug: "fluke-101-digital-multimeter-pocket",
    titleEn: "Fluke 101 Pocket Digital Multimeter",
    tier: "AUTHENTIC",
    pricePaisa: 495000,
    rating: 4.9,
    icon: "🔬",
    stageBg: "linear-gradient(145deg, #f3e8ff 0%, #fae8ff 100%)",
  },
  {
    id: "p6",
    slug: "oem-usb-c-pd-trigger-tester-board",
    titleEn: "RGB LED Bench Diffuser & Tester",
    tier: "BUDGET_SMART",
    pricePaisa: 145000,
    rating: 4.6,
    icon: "💡",
    stageBg: "linear-gradient(145deg, #e0f2fe 0%, #ede9fe 100%)",
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
      scrollContainerRef.current.scrollBy({ left: -260, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 260, behavior: "smooth" });
    }
  };

  return (
    <section
      aria-label="Recommended Hardware For You"
      style={{
        padding: "20px 20px 12px",
        maxWidth: "1340px",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Header matching Reference Design ("Recommended For You" + "See All") */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
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
          Recommended For You
        </h2>

        <Link
          href="/catalog"
          style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "#2563eb",
            textDecoration: "none",
          }}
        >
          See All
        </Link>
      </div>

      {/* Carousel Wrapper with Left/Right Side Floating Buttons */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={scrollLeft}
          aria-label="Previous recommended products"
          style={{
            position: "absolute",
            left: "-14px",
            top: "44%",
            transform: "translateY(-50%)",
            zIndex: 15,
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
            color: "#1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "18px",
            fontWeight: "700",
          }}
        >
          ‹
        </button>

        <div
          ref={scrollContainerRef}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(185px, 1fr))",
            gap: "14px",
            overflowX: "auto",
            paddingBottom: "8px",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {RECOMMENDED_PRODUCTS.map((prod) => {
            const isWishlisted = !!wishlistState[prod.id];

            return (
              <Link
                key={prod.id}
                href={`/products/${prod.slug}`}
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "18px",
                  padding: "10px",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
                  transition: "transform var(--duration-fast) var(--ease-spring)",
                }}
                className="interactive-scale"
              >
                {/* Pastel Product Stage */}
                <div
                  style={{
                    height: "136px",
                    borderRadius: "14px",
                    background: prod.stageBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "54px",
                    position: "relative",
                    marginBottom: "10px",
                  }}
                >
                  <span>{prod.icon}</span>

                  {/* Subtle Heart Icon at Top Right */}
                  <button
                    type="button"
                    onClick={(e) => toggleWishlist(prod.id, e)}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(255, 255, 255, 0.75)",
                      border: "none",
                      color: isWishlisted ? "#ff5e62" : "#94a3b8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    {isWishlisted ? "♥" : "♡"}
                  </button>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: "12.5px",
                    fontWeight: "600",
                    color: "var(--text-primary)",
                    lineHeight: "1.35",
                    margin: "0 0 10px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: "34px",
                  }}
                >
                  {prod.titleEn}
                </h3>

                {/* Bottom Row: Price on Left + Star Rating on Right */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: "800",
                      color: "var(--text-primary)",
                    }}
                  >
                    ৳{formatPaisa(prod.pricePaisa)}
                  </span>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span style={{ color: "#f59e0b" }}>★</span>
                    <span>{prod.rating.toFixed(1)}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={scrollRight}
          aria-label="Next recommended products"
          style={{
            position: "absolute",
            right: "-14px",
            top: "44%",
            transform: "translateY(-50%)",
            zIndex: 15,
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
            color: "#1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "18px",
            fontWeight: "700",
          }}
        >
          ›
        </button>
      </div>
    </section>
  );
}

