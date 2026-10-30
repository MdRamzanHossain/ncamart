"use client";

import React from "react";
import Link from "next/link";

interface TrustBenefit {
  icon: string;
  title: string;
  desc: string;
  linkHref: string;
  badgeBg: string;
}

const BENEFITS: TrustBenefit[] = [
  {
    icon: "⭐",
    title: "NCAMart Rewards",
    desc: "Earn points & unlock exclusive benefits.",
    linkHref: "/rewards",
    badgeBg: "linear-gradient(135deg, #ff5e62 0%, #f59e0b 100%)",
  },
  {
    icon: "👩‍🔬",
    title: "Engineer Picks",
    desc: "Handpicked favorites from top labs.",
    linkHref: "/authenticity",
    badgeBg: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
  },
  {
    icon: "🎁",
    title: "Holographic Seals",
    desc: "100% genuine verified for every order.",
    linkHref: "/verify",
    badgeBg: "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)",
  },
  {
    icon: "🤝",
    title: "Refer & Earn",
    desc: "Invite friends and earn rewards.",
    linkHref: "/referrals",
    badgeBg: "linear-gradient(135deg, #2dd4bf 0%, #0ea5e9 100%)",
  },
];

export function RewardsTrustStrip() {
  return (
    <section
      aria-label="Rewards & Trust Strip"
      style={{
        padding: "8px 24px 24px",
        maxWidth: "1320px",
        margin: "0 auto",
      }}
    >
      <div
        className="rewards-strip-grid"
        style={{
          borderRadius: "18px",
          background: "linear-gradient(90deg, #16143d 0%, #2d2673 50%, #1a184a 100%)",
          boxShadow: "0 10px 28px rgba(22, 20, 61, 0.25)",
          padding: "20px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: "20px",
          alignItems: "center",
        }}
      >
        {BENEFITS.map((item, idx) => (
          <Link
            key={item.title}
            href={item.linkHref}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              textDecoration: "none",
              paddingRight: idx < BENEFITS.length - 1 ? "12px" : "0",
              borderRight: idx < BENEFITS.length - 1 ? "1px solid rgba(255, 255, 255, 0.12)" : "none",
            }}
            className="interactive-scale"
          >
            {/* Circular/Rounded Glowing Icon Badge */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: item.badgeBg,
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                flexShrink: 0,
              }}
            >
              {item.icon}
            </div>

            {/* Explicit Crisp White Text (always legible in Light & Dark modes) */}
            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "800",
                  color: "#ffffff",
                  marginBottom: "2px",
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  fontSize: "11.5px",
                  color: "rgba(255, 255, 255, 0.78)",
                  lineHeight: "1.35",
                }}
              >
                {item.desc}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

