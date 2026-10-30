"use client";

import React from "react";
import Link from "next/link";

export function Footer() {
  return (
    <footer
      id="footer"
      className="storefront-footer"
      style={{
        backgroundColor: "#0b0e23",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "44px 24px 28px",
        marginTop: "auto",
        color: "#cbd5e1",
        fontSize: "13px",
      }}
    >
      <div
        style={{
          maxWidth: "1340px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
          gap: "32px",
          paddingBottom: "32px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        {/* Col 1: Brand & Physical Identity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #ff5e62 0%, #a855f7 50%, #38bdf8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: "900",
                fontSize: "16px",
              }}
            >
              N
            </div>
            <span
              style={{
                fontFamily: "var(--font-family-display)",
                fontWeight: "800",
                fontSize: "20px",
                letterSpacing: "0.08em",
                color: "#ffffff",
              }}
            >
              NCAMART
            </span>
          </div>

          <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.6", margin: 0 }}>
            Your world. Your style.
            <br />
            Your Nawabpur tech shopping destination.
          </p>

          <div style={{ fontSize: "10.5px", color: "#64748b" }}>
            Shop 42, Nawabpur Complex, Dhaka · BTRC Cleared
          </div>
        </div>

        {/* Col 2: Shop */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h4 style={{ color: "#ffffff", fontWeight: "700", fontSize: "13.5px", margin: "0 0 4px" }}>
            Shop
          </h4>
          <Link href="/categories" style={{ color: "#94a3b8", fontSize: "12px" }}>
            All Categories
          </Link>
          <Link href="/catalog?tier=AUTHENTIC" style={{ color: "#94a3b8", fontSize: "12px" }}>
            100% Authentic
          </Link>
          <Link href="/catalog?tier=BUDGET_SMART" style={{ color: "#94a3b8", fontSize: "12px" }}>
            Budget Smart OEM
          </Link>
          <Link href="/pre-orders" style={{ color: "#94a3b8", fontSize: "12px" }}>
            Pre-Order Direct
          </Link>
        </div>

        {/* Col 3: Customer Care */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h4 style={{ color: "#ffffff", fontWeight: "700", fontSize: "13.5px", margin: "0 0 4px" }}>
            Customer Care
          </h4>
          <Link href="/verify" style={{ color: "#fbbf24", fontSize: "12px", fontWeight: "600" }}>
            Verify Holographic Seal
          </Link>
          <Link href="/track" style={{ color: "#94a3b8", fontSize: "12px" }}>
            Track Order
          </Link>
          <Link href="/pages/warranty-policy" style={{ color: "#94a3b8", fontSize: "12px" }}>
            Returns &amp; Refunds
          </Link>
          <Link href="/showrooms/nawabpur" style={{ color: "#94a3b8", fontSize: "12px" }}>
            Contact &amp; Showroom Pickup
          </Link>
        </div>

        {/* Col 4: About NCAMart */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h4 style={{ color: "#ffffff", fontWeight: "700", fontSize: "13.5px", margin: "0 0 4px" }}>
            About NCAMart
          </h4>
          <Link href="/authenticity" style={{ color: "#94a3b8", fontSize: "12px" }}>
            About Us &amp; Certificates
          </Link>
          <Link href="/rewards" style={{ color: "#94a3b8", fontSize: "12px" }}>
            NCAMart Rewards
          </Link>
          <Link href="/pages/authentic-guarantee" style={{ color: "#94a3b8", fontSize: "12px" }}>
            Authenticity Guarantee
          </Link>
          <Link href="/referrals" style={{ color: "#94a3b8", fontSize: "12px" }}>
            Refer &amp; Earn
          </Link>
        </div>

        {/* Col 5: Get the App (matching Reference Design) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <h4 style={{ color: "#ffffff", fontWeight: "700", fontSize: "13.5px", margin: "0 0 4px" }}>
              Get the App
            </h4>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                color: "#ffffff",
                fontSize: "11px",
              }}
            >
              <span style={{ fontSize: "16px" }}>🍎</span>
              <div>
                <div style={{ fontSize: "8px", color: "#94a3b8" }}>Download on the</div>
                <div style={{ fontWeight: "700" }}>App Store</div>
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                color: "#ffffff",
                fontSize: "11px",
              }}
            >
              <span style={{ fontSize: "16px" }}>▶️</span>
              <div>
                <div style={{ fontSize: "8px", color: "#94a3b8" }}>GET IT ON</div>
                <div style={{ fontWeight: "700" }}>Google Play</div>
              </div>
            </div>
          </div>

          {/* Mini Smartphone Mockup matching Reference Footer Right */}
          <div
            style={{
              width: "58px",
              height: "88px",
              borderRadius: "12px",
              border: "2px solid rgba(56, 189, 248, 0.45)",
              background: "linear-gradient(145deg, #1e1b4b 0%, #312e81 50%, #ec4899 100%)",
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.4)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "18px" }}>📱</span>
            <span
              style={{
                fontSize: "7px",
                fontWeight: "800",
                color: "#ffffff",
                backgroundColor: "#ff5e62",
                padding: "1px 4px",
                borderRadius: "4px",
              }}
            >
              PWA
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Locale Row */}
      <div
        style={{
          maxWidth: "1340px",
          margin: "0 auto",
          paddingTop: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "11.5px",
          color: "#64748b",
        }}
      >
        <span>© {new Date().getFullYear()} NCAMart. All rights reserved.</span>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <Link href="/pages/terms" style={{ color: "#94a3b8" }}>
            Terms of Service
          </Link>
          <span>|</span>
          <Link href="/pages/privacy" style={{ color: "#94a3b8" }}>
            Privacy Policy
          </Link>
          <span>|</span>
          <Link href="/pages/shipping-rates" style={{ color: "#94a3b8" }}>
            Shipping &amp; VAT Policy
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8" }}>
          <span>🌐</span>
          <span>Bangladesh (EN / বাংলা) · ৳ BDT</span>
        </div>
      </div>
    </footer>
  );
}

