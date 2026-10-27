"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { formatPaisa } from "@/lib/money";
import { AuthenticBadge, BudgetSmartBadge } from "@/components/ui/badge";

interface ProductCardData {
  id: string;
  slug: string;
  titleEn: string;
  brand: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  pricePaisa: number;
  mrpPaisa?: number;
  rating: number;
  reviewsCount: number;
  stockStatus: string;
  badgeText?: string;
  icon: string;
}

const RECOMMENDED_PRODUCTS: ProductCardData[] = [
  {
    id: "p1",
    slug: "baseus-65w-gan-ultra-fast-charger",
    titleEn: "Baseus GaN5 Pro 65W Triple-Port Fast Charger",
    brand: "Baseus",
    tier: "AUTHENTIC",
    pricePaisa: 345000,
    mrpPaisa: 395000,
    rating: 4.9,
    reviewsCount: 128,
    stockStatus: "In Stock Dhaka",
    badgeText: "Official Baseus Warranty",
    icon: "⚡",
  },
  {
    id: "p2",
    slug: "mechanic-t12-pro-smart-soldering-station",
    titleEn: "Mechanic T12 Pro Smart Soldering Station 72W",
    brand: "Mechanic",
    tier: "AUTHENTIC",
    pricePaisa: 480000,
    mrpPaisa: 520000,
    rating: 4.8,
    reviewsCount: 95,
    stockStatus: "In Stock Dhaka",
    badgeText: "100% Sealed Genuine",
    icon: "🔥",
  },
  {
    id: "p3",
    slug: "oem-t12-replacement-iron-tips-set-5pcs",
    titleEn: "T12 Precision Soldering Iron Tips (Set of 5) OEM",
    brand: "Generic OEM",
    tier: "BUDGET_SMART",
    pricePaisa: 125000,
    rating: 4.6,
    reviewsCount: 64,
    stockStatus: "In Stock Dhaka",
    badgeText: "Zero-Replica Tested",
    icon: "🛠️",
  },
  {
    id: "p4",
    slug: "ugreen-100w-usb-c-braided-cable-2m",
    titleEn: "UGREEN 100W USB-C E-Marker Kevlar Braided Cable (2m)",
    brand: "UGREEN",
    tier: "AUTHENTIC",
    pricePaisa: 115000,
    mrpPaisa: 135000,
    rating: 4.9,
    reviewsCount: 210,
    stockStatus: "In Stock Dhaka",
    badgeText: "Official Ugreen BD",
    icon: "🔌",
  },
  {
    id: "p5",
    slug: "fluke-101-digital-multimeter-pocket",
    titleEn: "Fluke 101 Basic Pocket Digital Multimeter (CAT III 600V)",
    brand: "Fluke",
    tier: "AUTHENTIC",
    pricePaisa: 495000,
    mrpPaisa: 550000,
    rating: 5.0,
    reviewsCount: 78,
    stockStatus: "In Stock Dhaka",
    badgeText: "Official Calibration Certificate",
    icon: "🔬",
  },
  {
    id: "p6",
    slug: "oem-usb-c-pd-trigger-tester-board",
    titleEn: "Type-C PD/QC Fast Charge Decoy Trigger Board 20V",
    brand: "OEM Smart",
    tier: "BUDGET_SMART",
    pricePaisa: 35000,
    rating: 4.5,
    reviewsCount: 42,
    stockStatus: "In Stock Dhaka",
    badgeText: "QC Tested Nawabpur",
    icon: "⚙️",
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
      scrollContainerRef.current.scrollBy({ left: -320, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: "smooth" });
    }
  };

  return (
    <section
      aria-label="Recommended Hardware For You"
      style={{
        padding: "var(--space-2xl) var(--space-md)",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* Header with Navigation Controls */}
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
            HANDPICKED FOR YOUR BENCH
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
            Dual-Tier Recommended Hardware
          </h2>
        </div>

        {/* Carousel Prev/Next Buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={scrollLeft}
            aria-label="Previous recommended products"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all var(--duration-fast) ease",
            }}
            className="interactive-scale"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={scrollRight}
            aria-label="Next recommended products"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all var(--duration-fast) ease",
            }}
            className="interactive-scale"
          >
            ›
          </button>
        </div>
      </div>

      {/* Horizontal Product Cards Slider */}
      <div
        ref={scrollContainerRef}
        style={{
          display: "flex",
          gap: "var(--space-lg)",
          overflowX: "auto",
          paddingBottom: "var(--space-md)",
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
                minWidth: "270px",
                maxWidth: "290px",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-md)",
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                transition: "all var(--duration-fast) var(--ease-spring)",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
              }}
              className="interactive-scale"
            >
              {/* Product Thumbnail Stage */}
              <div
                style={{
                  height: "170px",
                  borderRadius: "var(--radius-lg)",
                  background: isAuthentic
                    ? "radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.12) 0%, rgba(18, 24, 38, 0.8) 100%)"
                    : "radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.12) 0%, rgba(18, 24, 38, 0.8) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "64px",
                  position: "relative",
                  marginBottom: "var(--space-md)",
                }}
              >
                <span>{prod.icon}</span>

                {/* Wishlist Heart Button */}
                <button
                  type="button"
                  onClick={(e) => toggleWishlist(prod.id, e)}
                  aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    backdropFilter: "blur(4px)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: isWishlisted ? "#f43f5e" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "transform var(--duration-fast) var(--ease-spring)",
                    transform: isWishlisted ? "scale(1.2)" : "scale(1)",
                  }}
                >
                  {isWishlisted ? "♥" : "♡"}
                </button>
              </div>

              {/* Product Tier & Brand */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  {isAuthentic ? (
                    <AuthenticBadge size="sm" />
                  ) : (
                    <BudgetSmartBadge size="sm" />
                  )}
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: "600" }}>
                    {prod.brand}
                  </span>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: "var(--font-weight-bold)",
                    color: "var(--text-primary)",
                    lineHeight: "1.4",
                    margin: "0 0 6px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    height: "38px",
                  }}
                >
                  {prod.titleEn}
                </h3>

                {/* Rating */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
                  <span style={{ color: "var(--tier-authentic-gold)", fontSize: "12px" }}>★</span>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-primary)" }}>
                    {prod.rating.toFixed(1)}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                    ({prod.reviewsCount})
                  </span>
                </div>
              </div>

              {/* Pricing & Availability Bottom Row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  paddingTop: "var(--space-sm)",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-family-mono)",
                      fontSize: "var(--font-size-base)",
                      fontWeight: "800",
                      color: isAuthentic ? "var(--tier-authentic-gold)" : "var(--tier-budget-teal)",
                    }}
                  >
                    ৳{formatPaisa(prod.pricePaisa)}
                  </div>
                  {prod.mrpPaisa && (
                    <div
                      style={{
                        fontFamily: "var(--font-family-mono)",
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                        textDecoration: "line-through",
                      }}
                    >
                      ৳{formatPaisa(prod.mrpPaisa)}
                    </div>
                  )}
                </div>

                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--color-status-success)",
                    fontWeight: "600",
                  }}
                >
                  {prod.stockStatus}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
