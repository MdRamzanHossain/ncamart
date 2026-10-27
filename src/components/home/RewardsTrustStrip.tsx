"use client";

import React from "react";
import Link from "next/link";

interface TrustBenefit {
  icon: string;
  title: string;
  desc: string;
  linkText: string;
  linkHref: string;
}

const BENEFITS: TrustBenefit[] = [
  {
    icon: "💎",
    title: "NCAMart Rewards",
    desc: "Earn points on every genuine order & unlock exclusive engineering perks.",
    linkText: "Learn more",
    linkHref: "/rewards",
  },
  {
    icon: "📜",
    title: "Distributor Verified",
    desc: "Handpicked genuine distributor stock with official warranty & Mushak 6.3 VAT.",
    linkText: "View partners",
    linkHref: "/authenticity",
  },
  {
    icon: "🛡️",
    title: "Holographic Seals",
    desc: "Destructive tamper-evident seals verified on /verify with Crockford Base32.",
    linkText: "Verify a seal",
    linkHref: "/verify",
  },
  {
    icon: "🤝",
    title: "Refer & Earn",
    desc: "Invite fellow tech engineers and earn store credit wallet cash instantly.",
    linkText: "Invite engineers",
    linkHref: "/referrals",
  },
];

export function RewardsTrustStrip() {
  return (
    <section
      aria-label="Rewards & Trust Strip"
      style={{
        backgroundColor: "#131826",
        backgroundImage: "linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(15, 23, 42, 0.95) 100%)",
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "var(--space-2xl) var(--space-md)",
        position: "relative",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "var(--space-xl)",
        }}
      >
        {BENEFITS.map((item) => (
          <div
            key={item.title}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-lg)",
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              {item.icon}
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: "var(--font-size-base)",
                fontWeight: "800",
                color: "var(--text-primary)",
              }}
            >
              {item.title}
            </div>

            {/* Description */}
            <div
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--text-secondary)",
                lineHeight: "1.5",
              }}
            >
              {item.desc}
            </div>

            {/* Link */}
            <Link
              href={item.linkHref}
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: "var(--tier-authentic-gold)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "4px",
              }}
            >
              <span>{item.linkText}</span>
              <span>→</span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
