"use client";

import React from "react";
import Link from "next/link";

export function FeaturedCampaignBanner() {
  return (
    <div
      style={{
        borderRadius: "20px",
        background: "linear-gradient(125deg, #0b1642 0%, #102a71 48%, #0284c7 100%)",
        border: "1px solid rgba(56, 189, 248, 0.35)",
        boxShadow: "0 12px 30px rgba(11, 22, 66, 0.18)",
        padding: "26px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "20px",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        flexWrap: "wrap",
      }}
    >
      {/* Left Content Hierarchy */}
      <div style={{ position: "relative", zIndex: 2, flex: "1 1 200px" }}>
        <span
          style={{
            display: "inline-block",
            fontSize: "10px",
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            padding: "3px 10px",
            borderRadius: "9999px",
            marginBottom: "10px",
          }}
        >
          DIRECT WHOLESALE CAMPAIGN
        </span>

        <h3
          style={{
            fontSize: "clamp(1.6rem, 2.4vw, 2.05rem)",
            fontWeight: "900",
            color: "#ffffff",
            lineHeight: "1.12",
            margin: "0 0 8px",
            letterSpacing: "-0.03em",
          }}
        >
          Nawabpur
          <br />
          Refresh Sale
        </h3>

        <div
          style={{
            fontSize: "14.5px",
            fontWeight: "700",
            color: "#bae6fd",
            marginBottom: "18px",
          }}
        >
          Up to 50% Off Verified Hardware
        </div>

        <Link href="/catalog?campaign=clearance" style={{ textDecoration: "none" }}>
          <button
            type="button"
            style={{
              padding: "11px 24px",
              borderRadius: "9999px",
              background: "linear-gradient(90deg, #ff5e62 0%, #ff7b54 100%)",
              color: "#ffffff",
              fontWeight: "700",
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(255, 94, 98, 0.4)",
            }}
            className="interactive-scale"
          >
            Shop The Sale →
          </button>
        </Link>
      </div>

      {/* Right Neon Cyan Frame Accent (Flexbox — never overlaps text!) */}
      <div
        style={{
          width: "145px",
          minHeight: "170px",
          borderRadius: "16px",
          border: "2px solid #38bdf8",
          boxShadow: "0 0 24px rgba(56, 189, 248, 0.45), inset 0 0 18px rgba(56, 189, 248, 0.25)",
          background: "linear-gradient(160deg, rgba(56, 189, 248, 0.18) 0%, rgba(168, 85, 247, 0.28) 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "14px",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "48px", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))" }}>⚡</div>
        <span
          style={{
            fontSize: "10px",
            fontWeight: "800",
            color: "#ffffff",
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            padding: "4px 10px",
            borderRadius: "9999px",
            border: "1px solid rgba(56, 189, 248, 0.5)",
            whiteSpace: "nowrap",
          }}
        >
          100% QC Sealed
        </span>
      </div>
    </div>
  );
}
