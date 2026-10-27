"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatPaisa } from "@/lib/money";

interface FlashDealItem {
  id: string;
  slug: string;
  title: string;
  discountPct: number;
  dealPricePaisa: number;
  mrpPaisa: number;
  icon: string;
  unitsLeft: number;
}

const FLASH_DEALS: FlashDealItem[] = [
  {
    id: "fd-1",
    slug: "mechanic-t12-pro-smart-soldering-station",
    title: "Mechanic T12 Pro Smart Soldering Station 72W",
    discountPct: 33,
    dealPricePaisa: 348000,
    mrpPaisa: 520000,
    icon: "🔥",
    unitsLeft: 7,
  },
  {
    id: "fd-2",
    slug: "anker-737-power-bank-24000mah-140w",
    title: "Anker 737 Power Bank (PowerCore 24K) 140W GaN",
    discountPct: 25,
    dealPricePaisa: 1125000,
    mrpPaisa: 1500000,
    icon: "🔋",
    unitsLeft: 3,
  },
  {
    id: "fd-3",
    slug: "relife-rl-004m-heat-insulation-pad",
    title: "RELIFE RL-004M Silicone Heat-Resistant Repair Mat",
    discountPct: 40,
    dealPricePaisa: 42000,
    mrpPaisa: 70000,
    icon: "📐",
    unitsLeft: 14,
  },
];

export function FlashOffersCard() {
  // Countdown timer state isolated to this component
  const [timeLeft, setTimeLeft] = useState({
    hours: 2,
    minutes: 45,
    seconds: 18,
  });

  const [activeDealIndex, setActiveDealIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else {
          // Reset to 6 hours cycle
          return { hours: 5, minutes: 59, seconds: 59 };
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const deal = FLASH_DEALS[activeDealIndex];
  const pad = (n: number) => n.toString().padStart(2, "0");

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
        position: "relative",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
      }}
    >
      {/* Card Header & Countdown */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "16px" }}>⚡</span>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: "800",
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Flash Offers
            </span>
          </div>

          <span
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              fontWeight: "700",
            }}
          >
            DAILY DROP
          </span>
        </div>

        {/* 3-Box Countdown Clock */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            backgroundColor: "var(--bg-canvas)",
            padding: "8px 12px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            marginBottom: "var(--space-md)",
          }}
        >
          {/* Hours Box */}
          <div style={{ textAlign: "center", minWidth: "44px" }}>
            <div
              style={{
                fontFamily: "var(--font-family-mono)",
                fontWeight: "900",
                fontSize: "16px",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-surface-elevated)",
                padding: "4px 6px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border-default)",
              }}
            >
              {pad(timeLeft.hours)}
            </div>
            <div style={{ fontSize: "8px", fontWeight: "700", color: "var(--text-tertiary)", marginTop: "2px" }}>
              HRS
            </div>
          </div>

          <span style={{ fontWeight: "900", color: "var(--text-tertiary)" }}>:</span>

          {/* Minutes Box */}
          <div style={{ textAlign: "center", minWidth: "44px" }}>
            <div
              style={{
                fontFamily: "var(--font-family-mono)",
                fontWeight: "900",
                fontSize: "16px",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-surface-elevated)",
                padding: "4px 6px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border-default)",
              }}
            >
              {pad(timeLeft.minutes)}
            </div>
            <div style={{ fontSize: "8px", fontWeight: "700", color: "var(--text-tertiary)", marginTop: "2px" }}>
              MINS
            </div>
          </div>

          <span style={{ fontWeight: "900", color: "var(--text-tertiary)" }}>:</span>

          {/* Seconds Box */}
          <div style={{ textAlign: "center", minWidth: "44px" }}>
            <div
              style={{
                fontFamily: "var(--font-family-mono)",
                fontWeight: "900",
                fontSize: "16px",
                color: "var(--tier-authentic-gold)",
                backgroundColor: "var(--bg-surface-elevated)",
                padding: "4px 6px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
            >
              {pad(timeLeft.seconds)}
            </div>
            <div style={{ fontSize: "8px", fontWeight: "700", color: "var(--text-tertiary)", marginTop: "2px" }}>
              SECS
            </div>
          </div>
        </div>

        {/* Featured Deal Card */}
        <Link
          href={`/products/${deal.slug}`}
          style={{
            display: "flex",
            flexDirection: "column",
            textDecoration: "none",
            gap: "var(--space-sm)",
          }}
        >
          {/* Image & Discount Badge */}
          <div
            style={{
              height: "140px",
              borderRadius: "var(--radius-lg)",
              background: "radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.15) 0%, rgba(18, 24, 38, 0.9) 100%)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "56px",
              position: "relative",
            }}
          >
            <span>{deal.icon}</span>

            {/* Discount Pill */}
            <span
              style={{
                position: "absolute",
                top: "8px",
                left: "8px",
                backgroundColor: "#ef4444",
                color: "#ffffff",
                fontSize: "10px",
                fontWeight: "900",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
              }}
            >
              {deal.discountPct}% OFF
            </span>

            {/* Units Left Indicator */}
            <span
              style={{
                position: "absolute",
                bottom: "8px",
                right: "8px",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(4px)",
                color: "var(--tier-authentic-gold)",
                fontSize: "10px",
                fontWeight: "700",
                padding: "2px 6px",
                borderRadius: "var(--radius-xs)",
              }}
            >
              Only {deal.unitsLeft} left
            </span>
          </div>

          {/* Deal Title */}
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: "var(--font-weight-bold)",
              color: "var(--text-primary)",
              lineHeight: "1.4",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              height: "38px",
            }}
          >
            {deal.title}
          </div>

          {/* Prices */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontFamily: "var(--font-family-mono)",
                fontSize: "var(--font-size-lg)",
                fontWeight: "900",
                color: "var(--tier-authentic-gold)",
              }}
            >
              ৳{formatPaisa(deal.dealPricePaisa)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-family-mono)",
                fontSize: "var(--font-size-xs)",
                color: "var(--text-tertiary)",
                textDecoration: "line-through",
              }}
            >
              ৳{formatPaisa(deal.mrpPaisa)}
            </span>
          </div>
        </Link>
      </div>

      {/* Pagination Dots */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          marginTop: "var(--space-md)",
          paddingTop: "var(--space-sm)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {FLASH_DEALS.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveDealIndex(idx)}
            aria-label={`View flash deal ${idx + 1}`}
            style={{
              width: idx === activeDealIndex ? "20px" : "6px",
              height: "6px",
              borderRadius: "var(--radius-full)",
              backgroundColor: idx === activeDealIndex ? "var(--tier-authentic-gold)" : "var(--border-default)",
              border: "none",
              cursor: "pointer",
              transition: "all var(--duration-fast) ease",
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
