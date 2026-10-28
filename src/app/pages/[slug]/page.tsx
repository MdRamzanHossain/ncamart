import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";
import { AuthenticBadge, BudgetSmartBadge } from "@/components/ui/badge";

interface PolicyContent {
  badge: string;
  title: string;
  titleBn: string;
  subtitle: string;
  sections: Array<{
    heading: string;
    body: string;
    bullets?: string[];
  }>;
  ctaLabel: string;
  ctaHref: string;
}

const PAGES_MAP: Record<string, PolicyContent> = {
  "authentic-guarantee": {
    badge: "100% AUTHENTIC TIER",
    title: "100% Authentic Money-Back & Holographic Seal Guarantee",
    titleBn: "১০০% আসল পণ্যের গ্যারান্টি ও হলোগ্রাফিক সিল",
    subtitle:
      "Every Authentic-tier item at NCAMart is sourced directly from authorized brand distributors in Bangladesh & Shenzhen and sealed with a destructive Crockford Base32 holographic label.",
    sections: [
      {
        heading: "1. Cryptographic Holographic Seal Binding",
        body: "Before leaving our Nawabpur Central Godown, every 100% Authentic unit undergoes a 3-point bench inspection and receives a unique tamper-evident holographic seal.",
        bullets: [
          "Unique Crockford Base32 code verifiable instantly at /verify",
          "Anti-clone rate-limiting and multi-scan velocity alerts",
          "Direct binding to your order number, SKU batch, and warranty period",
        ],
      },
      {
        heading: "2. 200% Counterfeit Protection Pledge",
        body: "We strictly prohibit gray-market or unlabelled copies in our Authentic tier. If any Authentic-tier product fails manufacturer serial or seal verification, we issue an immediate 100% refund plus Store Credit compensation.",
      },
    ],
    ctaLabel: "🛡️ Verify a Holographic Seal Now",
    ctaHref: "/verify",
  },
  "budget-smart-testing": {
    badge: "BUDGET SMART TIER",
    title: "Budget Smart 3-Point Godown QC Protocol",
    titleBn: "বাজেট স্মার্ট ৩-ধাপের কোয়ালিটি কন্ট্রোল প্রোটোকল",
    subtitle:
      "Honest, transparent OEM & workshop-grade accessories tested on our Nawabpur engineering bench so you never overpay or receive dead-on-arrival hardware.",
    sections: [
      {
        heading: "1. Zero Misrepresentation Policy",
        body: "Unlike traditional marketplace sellers who pass off OEM spares as brand-original, NCAMart clearly labels value-engineered OEM items under the Budget Smart (Teal) tier.",
      },
      {
        heading: "2. 3-Point Bench Verification Before Dispatch",
        body: "Every Budget Smart item sourced from Nawabpur wholesale lanes passes through our Central Godown QC station:",
        bullets: [
          "Step 1: Physical build, connector tolerance & insulation inspection",
          "Step 2: Load & voltage stability test (PD trigger / multimeter verification)",
          "Step 3: 7-day DOA replacement guarantee backed by Nawabpur Godown",
        ],
      },
    ],
    ctaLabel: "⚡ Browse Budget Smart Catalog",
    ctaHref: "/catalog?tier=BUDGET_SMART",
  },
  "warranty-policy": {
    badge: "RMA & WARRANTY GOVERNANCE",
    title: "RMA & Official Warranty Claim Process",
    titleBn: "ওয়ারেন্টি ও আরএমএ ক্লেইম নীতিমালা",
    subtitle:
      "Seamless paperless warranty claims powered by your holographic seal ID or registered Bangladesh mobile number.",
    sections: [
      {
        heading: "1. Paperless Seal-Based Warranty",
        body: "You never need to keep paper receipts. Simply enter your holographic seal code at /verify or open your Customer Account Warranty Portal to initiate an RMA claim in under 60 seconds.",
        bullets: [
          "100% Authentic Tier: 6 to 24 months official distributor warranty",
          "Budget Smart Tier: 7-day DOA replacement + 30-day bench test warranty",
          "Instant Store Credit Wallet payout or brand-new replacement dispatch",
        ],
      },
      {
        heading: "2. Nawabpur Drop-off or Nationwide Courier Reverse Pickup",
        body: "Return faulty items directly at Shop 42, Nawabpur Complex for same-day bench testing, or schedule a courier reverse pickup from any of Bangladesh's 64 districts.",
      },
    ],
    ctaLabel: "🛠️ Open Warranty & RMA Claim Portal",
    ctaHref: "/account/warranty",
  },
  "shipping-rates": {
    badge: "LOGISTICS & DISPATCH",
    title: "Nationwide Delivery Rates & Courier SLAs",
    titleBn: "ডেলিভারি চার্জ ও কুরিয়ার সময়সূচী",
    subtitle:
      "Direct dispatch from Nawabpur Central Godown via Steadfast, Pathao, and RedX with real-time 6-stage telemetry.",
    sections: [
      {
        heading: "1. Transparent Flat-Rate Shipping",
        body: "We subsidize nationwide heavy-parcel and tool delivery rates across Bangladesh:",
        bullets: [
          "Inside Dhaka Metro: ৳60 flat rate (Same-day / Next-day delivery)",
          "Dhaka Suburbs (Savar, Gazipur, Narayanganj, Keraniganj): ৳90",
          "Outside Dhaka (All 64 Districts Nationwide): ৳120 flat rate (48–72 hours)",
          "Showroom Counter Pickup (Shop 42, Nawabpur Complex): FREE with 6-Digit PIN",
        ],
      },
      {
        heading: "2. Cash on Delivery (COD) & Pre-Order Eligibility",
        body: "In-stock orders up to ৳10,000 qualify for Cash on Delivery (COD). Pre-order import items require a 15% booking deposit via SSLCommerz / bKash / Nagad.",
      },
    ],
    ctaLabel: "📦 Track an Active Consignment",
    ctaHref: "/track",
  },
  terms: {
    badge: "LEGAL & COMPLIANCE",
    title: "Terms & Conditions of Sale",
    titleBn: "বিক্রয় ও সেবার শর্তাবলী",
    subtitle:
      "Governed under the laws of Bangladesh, Digital Commerce Operation Guidelines, and NBR Mushak 6.3 VAT regulations.",
    sections: [
      {
        heading: "1. Dual-Tier Product Classification",
        body: "All listings explicitly declare either 100% Authentic or Budget Smart tier status, pricing in BDT (৳), and applicable warranty coverage prior to checkout.",
      },
      {
        heading: "2. Pre-Order 15% Deposit & 7-Day Settlement Window",
        body: "Pre-order deposits reserve allocation in our international import batch. Once the batch passes Nawabpur Godown QC, customers have 7 calendar days to settle the remaining 85% balance. If delayed beyond 14 days of promised ETA by NCAMart, customers are entitled to a 100% full deposit refund.",
      },
    ],
    ctaLabel: "Browse Storefront Catalog",
    ctaHref: "/catalog",
  },
  privacy: {
    badge: "DATA PROTECTION & PII SECURITY",
    title: "Privacy Policy & Cryptographic PII Protection",
    titleBn: "গোপনীয়তা নীতি ও তথ্য সুরক্ষা",
    subtitle:
      "How NCAMart protects customer phone numbers, shipping addresses, and payment telemetry.",
    sections: [
      {
        heading: "1. AES-256-GCM & Blind-Index PII Storage",
        body: "Customer mobile numbers and addresses are protected with strict access controls and cryptographic audit trails. Courier labels only receive minimum required delivery coordinates.",
      },
      {
        heading: "2. Right to Account Anonymization",
        body: "Customers may request account deletion and PII anonymization at any time from their Account Profile & Security settings while preserving statutory Mushak 6.3 tax ledger totals.",
      },
    ],
    ctaLabel: "👤 Manage Privacy in Account Settings",
    ctaHref: "/account/profile",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES_MAP[slug];
  return {
    title: page ? `${page.title} | NCAMart Nawabpur` : "Information & Policy | NCAMart",
    description: page?.subtitle || "NCAMart Nawabpur Complex Dual-Tier Policy & Operations Guide.",
  };
}

export default async function StorefrontPolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES_MAP[slug] || {
    badge: "NCAMART NAWABPUR OPERATIONS",
    title: slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    titleBn: "নবাবপুর কমপ্লেক্স তথ্য ও নীতিমালা",
    subtitle:
      "Official operational documentation for NCAMart Wholesale & Direct Retail Hub, Shop 42, Nawabpur Complex, Dhaka.",
    sections: [
      {
        heading: "Dual-Tier Transparency & Quality Assurance",
        body: "Every order dispatched from our Nawabpur Central Godown is backed by our dual-tier classification (100% Authentic & Budget Smart) and real-time order tracking.",
      },
    ],
    ctaLabel: "Explore Master Catalog",
    ctaHref: "/catalog",
  };

  return (
    <StorefrontShell>
      <div
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "var(--space-3xl) var(--space-md) var(--space-4xl)",
        }}
      >
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }}>
          <Link href="/" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
            Storefront
          </Link>
          {" / "}
          <span style={{ color: "var(--text-secondary)" }}>{page.title}</span>
        </div>

        <article
          style={{
            borderRadius: "var(--radius-xl)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            padding: "var(--space-2xl)",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xl)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: "var(--tier-authentic-gold-bg)",
                  color: "var(--tier-authentic-gold)",
                }}
              >
                {page.badge}
              </span>
              <AuthenticBadge size="sm" pulse={false} />
              <BudgetSmartBadge size="sm" pulse={false} />
            </div>

            <h1
              style={{
                fontSize: "clamp(1.6rem, 3vw, 2.25rem)",
                fontWeight: 900,
                color: "var(--text-primary)",
                margin: "0 0 6px",
                letterSpacing: "-0.03em",
              }}
            >
              {page.title}
            </h1>
            <div style={{ fontSize: "var(--font-size-base)", color: "#38bdf8", fontWeight: 600, marginBottom: "12px" }}>
              {page.titleBn}
            </div>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
              {page.subtitle}
            </p>
          </div>

          {page.sections.map((sec) => (
            <section
              key={sec.heading}
              style={{
                paddingTop: "var(--space-lg)",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <h2
                style={{
                  fontSize: "var(--font-size-lg)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: "0 0 var(--space-xs)",
                }}
              >
                {sec.heading}
              </h2>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
                {sec.body}
              </p>
              {sec.bullets && (
                <ul
                  style={{
                    marginTop: "var(--space-sm)",
                    paddingLeft: "20px",
                    color: "var(--text-secondary)",
                    fontSize: "var(--font-size-sm)",
                    lineHeight: 1.7,
                  }}
                >
                  {sec.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div
            style={{
              paddingTop: "var(--space-lg)",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-md)",
            }}
          >
            <Link
              href={page.ctaHref}
              style={{
                padding: "12px 22px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-brand-primary)",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "var(--font-size-sm)",
                textDecoration: "none",
              }}
            >
              {page.ctaLabel} →
            </Link>

            <Link
              href="/"
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--text-tertiary)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Return to Nawabpur Storefront
            </Link>
          </div>
        </article>
      </div>
    </StorefrontShell>
  );
}

