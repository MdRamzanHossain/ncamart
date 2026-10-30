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
}

const FLASH_DEALS: [FlashDealItem, ...FlashDealItem[]] = [
  {
    id: "fd-1",
    slug: "mechanic-t12-pro-smart-soldering-station",
    title: "Mechanic T12 Pro Station",
    discountPct: 33,
    dealPricePaisa: 348000,
    mrpPaisa: 520000,
    icon: "🔥",
  },
  {
    id: "fd-2",
    slug: "anker-737-power-bank-24000mah-140w",
    title: "Anker 737 PowerCore 140W",
    discountPct: 25,
    dealPricePaisa: 1125000,
    mrpPaisa: 1500000,
    icon: "🔋",
  },
  {
    id: "fd-3",
    slug: "relife-rl-004m-heat-insulation-pad",
    title: "RELIFE Silicone Repair Mat",
    discountPct: 40,
    dealPricePaisa: 42000,
    mrpPaisa: 70000,
    icon: "📐",
  },
];

export function FlashOffersCard() {
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
          return { hours: 5, minutes: 59, seconds: 59 };
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const deal = FLASH_DEALS[activeDealIndex] ?? FLASH_DEALS[0];
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div
      style={{
        backgroundColor: "#f1f5f9",
        border: "1px solid #e2e8f0",
        borderRadius: "20px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
      }}
    >
      {/* Header */}
      <div>
        <div
          style={{
            fontSize: "17px",
            fontWeight: "800",
            color: "#0f172a",
            letterSpacing: "-0.02em",
            marginBottom: "14px",
          }}
        >
          Flash Offers
        </div>

        {/* 3 Coral-Salmon Countdown Boxes matching Reference Design */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "18px",
          }}
        >
          {[
            { val: pad(timeLeft.hours), label: "HRS" },
            { val: pad(timeLeft.minutes), label: "MINS" },
            { val: pad(timeLeft.seconds), label: "SECS" },
          ].map((box) => (
            <div
              key={box.label}
              style={{
                width: "48px",
                height: "44px",
                borderRadius: "10px",
                background: "linear-gradient(180deg, #ff7b72 0%, #ff5e62 100%)",
                color: "#ffffff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(255, 94, 98, 0.3)",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "800", lineHeight: 1.1 }}>{box.val}</span>
              <span style={{ fontSize: "7.5px", fontWeight: "700", opacity: 0.9, letterSpacing: "0.04em" }}>
                {box.label}
              </span>
            </div>
          ))}
        </div>

        {/* Side-by-Side Product Showcase matching Reference Flash Offers Card */}
        <Link
          href={`/products/${deal.slug}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            textDecoration: "none",
            padding: "8px",
            borderRadius: "14px",
            backgroundColor: "rgba(255, 255, 255, 0.65)",
          }}
        >
          <div
            style={{
              width: "84px",
              height: "84px",
              borderRadius: "14px",
              backgroundColor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "42px",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
            }}
          >
            {deal.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#0f172a",
                lineHeight: "1.3",
                marginBottom: "6px",
              }}
            >
              {deal.title}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "16px", fontWeight: "900", color: "#0f172a" }}>
                ৳{formatPaisa(deal.dealPricePaisa)}
              </span>
              <span
                style={{
                  fontSize: "11.5px",
                  color: "#64748b",
                  textDecoration: "line-through",
                }}
              >
                ৳{formatPaisa(deal.mrpPaisa)}
              </span>
            </div>

            <div
              style={{
                fontSize: "10.5px",
                fontWeight: "700",
                color: "#475569",
                marginTop: "3px",
              }}
            >
              {deal.discountPct}% OFF
            </div>
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
          marginTop: "12px",
        }}
      >
        {FLASH_DEALS.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveDealIndex(idx)}
            aria-label={`View flash deal ${idx + 1}`}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: idx === activeDealIndex ? "#2563eb" : "#cbd5e1",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

