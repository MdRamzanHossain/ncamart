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
      {/* Header & Countdown Row */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
            gap: "8px",
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
            ⚡ Flash Offers
          </span>

          {/* 3 Coral-Salmon Countdown Boxes */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {[
              { val: pad(timeLeft.hours), label: "HRS" },
              { val: pad(timeLeft.minutes), label: "MIN" },
              { val: pad(timeLeft.seconds), label: "SEC" },
            ].map((box) => (
              <div
                key={box.label}
                style={{
                  minWidth: "38px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "linear-gradient(180deg, #ff7b72 0%, #ff5e62 100%)",
                  color: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  boxShadow: "0 3px 8px rgba(255, 94, 98, 0.25)",
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "800", lineHeight: 1.05 }}>{box.val}</span>
                <span style={{ fontSize: "7px", fontWeight: "700", opacity: 0.92 }}>
                  {box.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Side-by-Side Product Showcase */}
        <Link
          href={`/products/${deal.slug}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            textDecoration: "none",
            padding: "12px",
            borderRadius: "16px",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              width: "76px",
              height: "76px",
              borderRadius: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "38px",
              flexShrink: 0,
            }}
          >
            {deal.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: "inline-block",
                fontSize: "10px",
                fontWeight: "800",
                color: "#dc2626",
                backgroundColor: "#fee2e2",
                padding: "2px 7px",
                borderRadius: "9999px",
                marginBottom: "5px",
              }}
            >
              SAVE {deal.discountPct}%
            </span>

            <div
              style={{
                fontSize: "13.5px",
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
                  color: "#94a3b8",
                  textDecoration: "line-through",
                }}
              >
                ৳{formatPaisa(deal.mrpPaisa)}
              </span>
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
          gap: "8px",
          marginTop: "12px",
        }}
      >
        {FLASH_DEALS.map((d, idx) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActiveDealIndex(idx)}
            aria-label={`View flash deal ${idx + 1}`}
            style={{
              width: idx === activeDealIndex ? "20px" : "8px",
              height: "8px",
              borderRadius: "9999px",
              backgroundColor: idx === activeDealIndex ? "#2563eb" : "#cbd5e1",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
