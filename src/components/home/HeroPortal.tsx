"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

    // Damped 3D rotation angle (max 12 degrees)
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

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
        backgroundColor: "var(--bg-canvas)",
        backgroundImage: "radial-gradient(circle at 50% 30%, rgba(245, 158, 11, 0.08) 0%, rgba(13, 148, 136, 0.05) 45%, transparent 70%)",
        padding: "calc(var(--space-2xl) + 12px) var(--space-md) var(--space-2xl)",
        perspective: "1200px",
        minHeight: "560px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background Hologram Portal Ring */}
      <div
        style={{
          position: "absolute",
          top: "45%",
          left: "50%",
          width: "min(680px, 90vw)",
          height: "min(680px, 90vw)",
          borderRadius: "50%",
          transform: `translate(-50%, -50%) rotateX(${rotate.x * 0.4}deg) rotateY(${rotate.y * 0.4}deg)`,
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(20, 184, 166, 0.12) 35%, rgba(11, 15, 25, 0.02) 70%, transparent 100%)",
          border: "1.5px solid rgba(245, 158, 11, 0.2)",
          boxShadow: "0 0 80px rgba(245, 158, 11, 0.18), inset 0 0 60px rgba(20, 184, 166, 0.12)",
          pointerEvents: "none",
          transition: isHovered ? "transform 0.1s ease-out" : "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }}
      >
        {/* Inner concentric ring */}
        <div
          style={{
            position: "absolute",
            inset: "40px",
            borderRadius: "50%",
            border: "1px dashed rgba(20, 184, 166, 0.3)",
            animation: "spin 40s linear infinite",
          }}
        />
      </div>

      {/* Floating 3D Category Preview Cards reacting to mouse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        {/* Floating Card 1: GaN Fast Chargers */}
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "max(5%, 20px)",
            backgroundColor: "rgba(18, 24, 38, 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-lg)",
            padding: "10px 14px",
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            transform: `translate3d(${rotate.y * 1.8}px, ${rotate.x * 1.5}px, 40px)`,
            transition: isHovered ? "transform 0.1s ease-out" : "transform 0.6s ease",
          }}
          className="desktop-only-float"
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--tier-authentic-gold-bg)",
              color: "var(--tier-authentic-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-primary)" }}>
              65W–140W GaN
            </div>
            <div style={{ fontSize: "9px", color: "var(--tier-authentic-gold)", fontWeight: "600" }}>
              Official Warranty
            </div>
          </div>
        </div>

        {/* Floating Card 2: Soldering & Bench */}
        <div
          style={{
            position: "absolute",
            top: "16%",
            right: "max(5%, 20px)",
            backgroundColor: "rgba(18, 24, 38, 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(20, 184, 166, 0.3)",
            borderRadius: "var(--radius-lg)",
            padding: "10px 14px",
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            transform: `translate3d(${rotate.y * -1.8}px, ${rotate.x * 1.8}px, 30px)`,
            transition: isHovered ? "transform 0.1s ease-out" : "transform 0.6s ease",
          }}
          className="desktop-only-float"
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--tier-budget-teal-bg)",
              color: "var(--tier-budget-teal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            🔧
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-primary)" }}>
              T12 Soldering
            </div>
            <div style={{ fontSize: "9px", color: "var(--tier-budget-teal)", fontWeight: "600" }}>
              Tested OEM Gear
            </div>
          </div>
        </div>

        {/* Floating Card 3: Tamper-Evident Seal Indicator */}
        <div
          style={{
            position: "absolute",
            bottom: "16%",
            left: "max(8%, 30px)",
            backgroundColor: "rgba(18, 24, 38, 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            borderRadius: "var(--radius-lg)",
            padding: "10px 14px",
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            transform: `translate3d(${rotate.y * 1.4}px, ${rotate.x * -1.4}px, 25px)`,
            transition: isHovered ? "transform 0.1s ease-out" : "transform 0.6s ease",
          }}
          className="desktop-only-float"
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--tier-authentic-gold-bg)",
              color: "var(--tier-authentic-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-primary)" }}>
              100% Sealed
            </div>
            <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>
              Crockford Base32
            </div>
          </div>
        </div>
      </div>

      {/* Main Center Content Hierarchy */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "880px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-md)",
        }}
      >
        {/* Pill Tagline */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 14px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--tier-authentic-gold-bg)",
            border: "1px solid var(--tier-authentic-gold-border)",
            fontSize: "var(--font-size-xs)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--tier-authentic-gold)",
            letterSpacing: "0.04em",
          }}
        >
          <span>✨</span>
          <span>DIRECT FROM NAWABPUR WHOLESALE TECH HUB</span>
        </div>

        {/* Display Headline */}
        <h1
          style={{
            fontSize: "clamp(2rem, 5vw, 3.8rem)",
            fontWeight: "900",
            fontFamily: "var(--font-family-display)",
            lineHeight: "1.12",
            letterSpacing: "-0.04em",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Your World Of Tech Shopping{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #14b8a6 60%, #38bdf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Starts Here.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "clamp(0.95rem, 1.8vw, 1.15rem)",
            color: "var(--text-secondary)",
            maxWidth: "680px",
            lineHeight: "1.6",
            margin: 0,
          }}
        >
          Explore 100% authentic gear, tested OEM alternatives, and shop smarter with
          tamper-evident holographic seals directly from Nawabpur Complex.
        </p>

        {/* Primary Call to Action Button */}
        <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-sm)", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/catalog" style={{ textDecoration: "none" }}>
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 32px",
                borderRadius: "var(--radius-full)",
                background: "linear-gradient(135deg, #ff6b35 0%, #f59e0b 100%)",
                color: "#ffffff",
                fontWeight: "800",
                fontSize: "var(--font-size-base)",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(255, 107, 53, 0.4), 0 0 12px rgba(245, 158, 11, 0.3)",
                transition: "all var(--duration-fast) var(--ease-spring)",
              }}
              className="interactive-scale"
            >
              <span>Shop Now</span>
              <span style={{ fontSize: "18px" }}>→</span>
            </button>
          </Link>

          <Link href="/verify" style={{ textDecoration: "none" }}>
            <Button
              variant="outline"
              size="lg"
              style={{
                borderRadius: "var(--radius-full)",
                borderColor: "var(--tier-authentic-gold)",
                color: "var(--tier-authentic-gold)",
                gap: "6px",
              }}
            >
              <span>🛡️</span>
              <span>Verify Holographic Seal</span>
            </Button>
          </Link>
        </div>

        {/* 4-Pillar Trust Micro-Bar */}
        <div
          className="hero-trust-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
            gap: "var(--space-md)",
            width: "100%",
            maxWidth: "840px",
            marginTop: "var(--space-xl)",
            paddingTop: "var(--space-lg)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
            <span style={{ fontSize: "20px" }}>🛡️</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>100% Sealed</div>
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Tamper-evident seals</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
            <span style={{ fontSize: "20px" }}>⚡</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>24h Drop-and-Pack</div>
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Same-day dispatch Dhaka</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
            <span style={{ fontSize: "20px" }}>🔄</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>Doorstep RMA Swap</div>
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Zero-hassle returns</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
            <span style={{ fontSize: "20px" }}>🎧</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>24/7 Nawabpur Care</div>
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Direct engineer support</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 900px) {
          .desktop-only-float {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
}
