"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";

export function HeroPortal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  return (
    <section
      aria-label="Flagship Hero Shopping Portal"
      className="hero-portal-section"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(130deg, #070b22 0%, #0f1742 42%, #1d1252 75%, #0b1136 100%)",
        padding: "44px 24px 86px",
        perspective: "1200px",
        minHeight: "520px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
      }}
    >
      {/* Ambient Cosmic Neon Glows */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "15%",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(168, 85, 247, 0.14) 45%, transparent 70%)",
          filter: "blur(30px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "5%",
          width: "420px",
          height: "420px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%)",
          filter: "blur(30px)",
          pointerEvents: "none",
        }}
      />

      {/* Main 2-Column Hero Grid matching Reference Design */}
      <div
        className="hero-inner-grid"
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: "1320px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          alignItems: "center",
          gap: "40px",
        }}
      >
        {/* Left Column: Headline, Subtitle, Shop Now Button, 4 Pillars */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "20px",
            maxWidth: "560px",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(2.4rem, 4.8vw, 4.1rem)",
              fontWeight: "900",
              fontFamily: "var(--font-family-display)",
              lineHeight: "1.08",
              letterSpacing: "-0.03em",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Your World
            <br />
            Of Shopping
            <br />
            <span style={{ color: "#ff6e6c" }}>Starts </span>
            <span style={{ color: "#2dd4bf" }}>Here.</span>
          </h1>

          <p
            style={{
              fontSize: "clamp(0.95rem, 1.4vw, 1.08rem)",
              color: "rgba(226, 232, 240, 0.88)",
              maxWidth: "430px",
              lineHeight: "1.6",
              margin: 0,
            }}
          >
            Explore endless choices, discover 100% authentic &amp; tested OEM hardware, and shop smarter in a whole new way.
          </p>

          {/* CTA Row */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginTop: "4px" }}>
            <Link href="/catalog" style={{ textDecoration: "none" }}>
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "13px 30px",
                  borderRadius: "9999px",
                  background: "linear-gradient(90deg, #ff5e62 0%, #ff7b54 100%)",
                  color: "#ffffff",
                  fontWeight: "700",
                  fontSize: "15px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 10px 26px rgba(255, 94, 98, 0.45)",
                  transition: "all var(--duration-fast) var(--ease-spring)",
                }}
                className="interactive-scale"
              >
                <span>Shop Now</span>
                <span style={{ fontSize: "17px" }}>→</span>
              </button>
            </Link>

            <Link
              href="/verify"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 20px",
                borderRadius: "9999px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#fbbf24",
                fontWeight: "700",
                fontSize: "13px",
                textDecoration: "none",
                backdropFilter: "blur(8px)",
              }}
              className="interactive-scale"
            >
              <span>🛡️</span>
              <span>Verify Seal</span>
            </Link>
          </div>

          {/* 4-Pillar Trust Row (matching Reference Icons below Shop Now) */}
          <div
            className="hero-trust-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, auto)",
              gap: "28px",
              marginTop: "12px",
              paddingTop: "8px",
            }}
          >
            {[
              { icon: "🛍️", line1: "Secure", line2: "Shopping" },
              { icon: "🚚", line1: "Fast", line2: "Delivery" },
              { icon: "🔄", line1: "Easy", line2: "Returns" },
              { icon: "🎧", line1: "24/7", line2: "Support" },
            ].map((pillar) => (
              <div
                key={pillar.line2}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "17px",
                  }}
                >
                  {pillar.icon}
                </div>
                <div style={{ fontSize: "11px", lineHeight: "1.25", color: "rgba(255, 255, 255, 0.88)", fontWeight: "600" }}>
                  <div>{pillar.line1}</div>
                  <div>{pillar.line2}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Futuristic Holographic Cylinder Portal & Floating Product Windows */}
        <div
          style={{
            position: "relative",
            height: "410px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `rotateX(${rotate.x * 0.35}deg) rotateY(${rotate.y * 0.35}deg)`,
            transition: isHovered ? "transform 0.1s ease-out" : "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Holographic Cylinder Body */}
          <div
            style={{
              position: "relative",
              width: "min(360px, 82vw)",
              height: "350px",
              borderRadius: "28px",
              background:
                "linear-gradient(180deg, rgba(56, 189, 248, 0.24) 0%, rgba(99, 102, 241, 0.10) 50%, rgba(45, 212, 191, 0.28) 100%)",
              borderLeft: "1.5px solid rgba(56, 189, 248, 0.55)",
              borderRight: "1.5px solid rgba(56, 189, 248, 0.55)",
              boxShadow:
                "0 0 60px rgba(56, 189, 248, 0.25), inset 0 0 50px rgba(56, 189, 248, 0.2)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Top Neon Portal Ring */}
            <div
              style={{
                width: "106%",
                height: "36px",
                marginTop: "-18px",
                borderRadius: "50%",
                border: "2.5px solid #38bdf8",
                background: "radial-gradient(ellipse at center, rgba(56, 189, 248, 0.45) 0%, rgba(14, 165, 233, 0.1) 70%)",
                boxShadow: "0 0 24px #38bdf8, inset 0 0 14px #38bdf8",
              }}
            />

            {/* Center Shopper / Tech Hub Hologram Core */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                zIndex: 3,
              }}
            >
              <div
                style={{
                  width: "76px",
                  height: "76px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, rgba(15, 23, 42, 0.85) 100%)",
                  border: "2px solid rgba(56, 189, 248, 0.7)",
                  boxShadow: "0 0 28px rgba(56, 189, 248, 0.55)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "34px",
                }}
              >
                🛡️
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(15, 23, 42, 0.75)",
                  border: "1px solid rgba(56, 189, 248, 0.5)",
                  color: "#7dd3fc",
                }}
              >
                Hologram Verified Hub
              </span>
            </div>

            {/* Bottom Glowing Platform Pedestal */}
            <div
              style={{
                width: "118%",
                height: "46px",
                marginBottom: "-22px",
                borderRadius: "50%",
                border: "3px solid #38bdf8",
                background:
                  "radial-gradient(ellipse at center, rgba(45, 212, 191, 0.55) 0%, rgba(56, 189, 248, 0.25) 55%, rgba(15, 23, 42, 0.9) 100%)",
                boxShadow: "0 0 36px #38bdf8, 0 10px 30px rgba(45, 212, 191, 0.45), inset 0 0 20px #38bdf8",
              }}
            />
          </div>

          {/* Floating Glassmorphic Card 1 — Top Left (GaN Fast Power) */}
          <Link
            href="/catalog?category=chargers-power"
            style={{
              position: "absolute",
              top: "14px",
              left: "4%",
              width: "118px",
              padding: "10px",
              borderRadius: "16px",
              background: "linear-gradient(145deg, rgba(255, 255, 255, 0.18) 0%, rgba(30, 41, 59, 0.65) 100%)",
              backdropFilter: "blur(12px)",
              border: "1.5px solid rgba(125, 211, 252, 0.55)",
              boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35), 0 0 16px rgba(56, 189, 248, 0.25)",
              textDecoration: "none",
              color: "#ffffff",
              textAlign: "center",
              transform: `translate3d(${rotate.y * 1.2}px, ${rotate.x * 1.1}px, 30px)`,
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: "30px", marginBottom: "4px" }}>⚡</div>
            <div style={{ fontSize: "11px", fontWeight: "700" }}>GaN Power</div>
            <div style={{ fontSize: "9px", color: "#7dd3fc" }}>65W–140W</div>
          </Link>

          {/* Floating Glassmorphic Card 2 — Top Right (Electronics & Audio) */}
          <Link
            href="/catalog?category=audio-dacs"
            style={{
              position: "absolute",
              top: "10px",
              right: "4%",
              width: "126px",
              padding: "12px 10px",
              borderRadius: "16px",
              background: "linear-gradient(145deg, rgba(56, 189, 248, 0.25) 0%, rgba(30, 41, 59, 0.7) 100%)",
              backdropFilter: "blur(12px)",
              border: "1.5px solid rgba(56, 189, 248, 0.65)",
              boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35), 0 0 20px rgba(56, 189, 248, 0.3)",
              textDecoration: "none",
              color: "#ffffff",
              textAlign: "center",
              transform: `translate3d(${rotate.y * -1.2}px, ${rotate.x * 1.2}px, 40px)`,
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "4px" }}>🎧</div>
            <div style={{ fontSize: "11px", fontWeight: "700" }}>Electronics</div>
            <div style={{ fontSize: "9px", color: "#bae6fd" }}>Hi-Res Audio</div>
          </Link>

          {/* Floating Glassmorphic Card 3 — Middle Left (Bench & Soldering) */}
          <Link
            href="/catalog?category=engineering-tools"
            style={{
              position: "absolute",
              top: "42%",
              left: "-2%",
              width: "120px",
              padding: "10px",
              borderRadius: "16px",
              background: "linear-gradient(145deg, rgba(244, 114, 182, 0.22) 0%, rgba(30, 41, 59, 0.7) 100%)",
              backdropFilter: "blur(12px)",
              border: "1.5px solid rgba(244, 114, 182, 0.5)",
              boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
              textDecoration: "none",
              color: "#ffffff",
              textAlign: "center",
              transform: `translate3d(${rotate.y * 1.5}px, ${rotate.x * -1.1}px, 35px)`,
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "4px" }}>🔬</div>
            <div style={{ fontSize: "11px", fontWeight: "700" }}>Bench Lab</div>
            <div style={{ fontSize: "9px", color: "#fbcfe8" }}>T12 &amp; Scopes</div>
          </Link>

          {/* Floating Glassmorphic Card 4 — Middle Right (Smart Gadgets) */}
          <Link
            href="/catalog?category=smart-wearables"
            style={{
              position: "absolute",
              top: "44%",
              right: "-2%",
              width: "122px",
              padding: "10px",
              borderRadius: "16px",
              background: "linear-gradient(145deg, rgba(251, 191, 36, 0.2) 0%, rgba(30, 41, 59, 0.7) 100%)",
              backdropFilter: "blur(12px)",
              border: "1.5px solid rgba(251, 191, 36, 0.5)",
              boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
              textDecoration: "none",
              color: "#ffffff",
              textAlign: "center",
              transform: `translate3d(${rotate.y * -1.4}px, ${rotate.x * -1.2}px, 35px)`,
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "4px" }}>⌚</div>
            <div style={{ fontSize: "11px", fontWeight: "700" }}>Smart Tech</div>
            <div style={{ fontSize: "9px", color: "#fde68a" }}>Wearables</div>
          </Link>

          {/* Floating Social/Trust Badges matching Reference (Heart, Thumbs-Up, Cart) */}
          <div
            className="desktop-only-float"
            style={{
              position: "absolute",
              bottom: "58px",
              left: "12%",
              padding: "6px 10px",
              borderRadius: "10px",
              backgroundColor: "rgba(56, 189, 248, 0.22)",
              border: "1px solid rgba(56, 189, 248, 0.5)",
              backdropFilter: "blur(8px)",
              fontSize: "11px",
              fontWeight: "700",
              color: "#ffffff",
              zIndex: 6,
            }}
          >
            👍 99.8% Genuine
          </div>

          <div
            className="desktop-only-float"
            style={{
              position: "absolute",
              bottom: "64px",
              right: "14%",
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              color: "#ff5e62",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              boxShadow: "0 6px 16px rgba(255, 94, 98, 0.4)",
              zIndex: 6,
            }}
          >
            ❤️
          </div>
        </div>
      </div>
    </section>
  );
}

