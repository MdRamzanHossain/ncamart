"use client";

import React from "react";
import Link from "next/link";

export function FeaturedCampaignBanner() {
  return (
    <div
      style={{
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #042f2e 100%)",
        border: "1px solid rgba(245, 158, 11, 0.3)",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4), inset 0 0 40px rgba(245, 158, 11, 0.15)",
        padding: "var(--space-xl)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Glow Orb */}
      <div
        style={{
          position: "absolute",
          top: "-30px",
          right: "-30px",
          width: "180px",
          height: "180px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, transparent 70%)",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      {/* Top Banner Tag */}
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "rgba(245, 158, 11, 0.18)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            fontSize: "10px",
            fontWeight: "800",
            color: "var(--tier-authentic-gold)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "var(--space-md)",
          }}
        >
          <span>🔥</span>
          <span>SPECIAL CAMPAIGN EVENT</span>
        </div>

        <h3
          style={{
            fontSize: "clamp(1.4rem, 2.5vw, 1.8rem)",
            fontWeight: "900",
            color: "#ffffff",
            lineHeight: "1.2",
            margin: "0 0 var(--space-sm)",
            letterSpacing: "-0.03em",
          }}
        >
          Nawabpur Tech Clearance
        </h3>

        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "rgba(255, 255, 255, 0.8)",
            lineHeight: "1.5",
            margin: "0 0 var(--space-md)",
          }}
        >
          Up to 50% Off authentic GaN chargers, multimeter leads, and bench soldering gear.
          All items backed by 100% destructive holographic seals.
        </p>

        {/* Feature Highlights Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "var(--space-md)" }}>
          <span
            style={{
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              fontWeight: "600",
            }}
          >
            ✓ Authentic Distributor Stock
          </span>
          <span
            style={{
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              fontWeight: "600",
            }}
          >
            ✓ Same-Day Dhaka Dispatch
          </span>
        </div>
      </div>

      {/* Primary Action Button */}
      <div>
        <Link href="/catalog?campaign=clearance" style={{ textDecoration: "none" }}>
          <button
            type="button"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: "var(--radius-full)",
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "#0b0f19",
              fontWeight: "800",
              fontSize: "var(--font-size-sm)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(245, 158, 11, 0.4)",
              transition: "transform var(--duration-fast) var(--ease-spring)",
            }}
            className="interactive-scale"
          >
            <span>Shop The Sale</span>
            <span>→</span>
          </button>
        </Link>
      </div>
    </div>
  );
}
