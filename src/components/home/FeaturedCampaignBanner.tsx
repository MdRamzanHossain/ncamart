"use client";

import React from "react";
import Link from "next/link";

export function FeaturedCampaignBanner() {
  return (
    <div
      style={{
        borderRadius: "20px",
        background: "linear-gradient(125deg, #0b1642 0%, #102a71 48%, #0284c7 100%)",
        border: "1px solid rgba(56, 189, 248, 0.4)",
        boxShadow: "0 12px 30px rgba(11, 22, 66, 0.25)",
        padding: "26px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Neon Cyan Frame Accent on Right (matching Reference Center Banner) */}
      <div
        style={{
          position: "absolute",
          right: "22px",
          top: "18px",
          bottom: "18px",
          width: "160px",
          borderRadius: "14px",
          border: "2.5px solid #38bdf8",
          boxShadow: "0 0 24px rgba(56, 189, 248, 0.65), inset 0 0 18px rgba(56, 189, 248, 0.35)",
          background: "linear-gradient(160deg, rgba(56, 189, 248, 0.18) 0%, rgba(168, 85, 247, 0.28) 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: "52px", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.4))" }}>⚡</div>
        <span
          style={{
            fontSize: "10px",
            fontWeight: "800",
            color: "#ffffff",
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            padding: "3px 8px",
            borderRadius: "9999px",
            border: "1px solid rgba(56, 189, 248, 0.5)",
          }}
        >
          100% Sealed
        </span>
      </div>

      {/* Left Content Hierarchy */}
      <div style={{ position: "relative", zIndex: 2, maxWidth: "250px" }}>
        <h3
          style={{
            fontSize: "clamp(1.6rem, 2.4vw, 2.1rem)",
            fontWeight: "900",
            color: "#ffffff",
            lineHeight: "1.1",
            margin: "0 0 10px",
            letterSpacing: "-0.03em",
          }}
        >
          Nawabpur
          <br />
          Refresh
          <br />
          Sale
        </h3>

        <div
          style={{
            fontSize: "15px",
            fontWeight: "700",
            color: "rgba(255, 255, 255, 0.92)",
            marginBottom: "18px",
          }}
        >
          Up to 50% Off
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
              boxShadow: "0 6px 18px rgba(255, 94, 98, 0.45)",
              transition: "transform var(--duration-fast) var(--ease-spring)",
            }}
            className="interactive-scale"
          >
            Shop The Sale
          </button>
        </Link>
      </div>
    </div>
  );
}

