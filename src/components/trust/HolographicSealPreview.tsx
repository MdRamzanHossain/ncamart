"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";

export interface HolographicSealPreviewProps {
  sealId?: string;
  tier?: "AUTHENTIC" | "BUDGET_SMART";
  showExplainer?: boolean;
}

export function HolographicSealPreview({
  sealId = "NC-9X4K-2M7B",
  tier = "AUTHENTIC",
  showExplainer = true,
}: HolographicSealPreviewProps) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVoidToggled, setIsVoidToggled] = useState(false);
  const [activeTab, setActiveTab] = useState<"official" | "ncamart">("official");

  const cardRef = useRef<HTMLDivElement>(null);
  const isAuthentic = tier === "AUTHENTIC";

  // Mouse move tilt handler for 60fps responsive 3D feel
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Constrain tilt angle to max +/- 16 degrees
    const rX = ((y - centerY) / centerY) * -16;
    const rY = ((x - centerX) / centerX) * 16;

    // Glare moves in opposite direction
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setRotateX(rX);
    setRotateY(rY);
    setGlarePosition({ x: glareX, y: glareY });
  }, []);

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => {
    setIsHovering(false);
    setRotateX(0);
    setRotateY(0);
    setGlarePosition({ x: 50, y: 50 });
  };

  // Device orientation fallback for mobile gyroscope
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        // Clamp gamma (-90 to 90) and beta (-180 to 180) to tilt range
        const rY = Math.max(-15, Math.min(15, e.gamma / 2));
        const rX = Math.max(-15, Math.min(15, (e.beta - 45) / 2));
        setRotateX(rX);
        setRotateY(rY);
      }
    };

    if (typeof window !== "undefined" && window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }
    return () => {
      if (typeof window !== "undefined" && window.DeviceOrientationEvent) {
        window.removeEventListener("deviceorientation", handleOrientation, true);
      }
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        width: "100%",
        borderRadius: "16px",
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
        padding: "24px",
      }}
    >
      {/* Header with Title and VOID Pattern Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>💎</span>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc", margin: 0 }}>
              Physical Holographic Security Seal
            </h3>
          </div>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
            Tamper-evident serialized sticker applied after lab QC inspection
          </p>
        </div>

        {/* Destructive VOID Pattern Simulation Toggle */}
        <button
          type="button"
          onClick={() => setIsVoidToggled((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
            border: isVoidToggled ? "1px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.15)",
            backgroundColor: isVoidToggled ? "rgba(239, 68, 68, 0.15)" : "rgba(255, 255, 255, 0.04)",
            color: isVoidToggled ? "#fca5a5" : "#cbd5e1",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: isVoidToggled ? "#ef4444" : "#64748b",
            }}
          />
          <span>{isVoidToggled ? "Reset Foil (Intact)" : "Simulate Peel (VOID Pattern)"}</span>
        </button>
      </div>

      {/* 3D Card Interactive Stage */}
      <div
        style={{
          perspective: "1000px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px 0",
        }}
      >
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: "relative",
            width: "320px",
            height: "190px",
            borderRadius: "14px",
            transformStyle: "preserve-3d",
            transform: isHovering
              ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`
              : "rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
            transition: isHovering ? "transform 0.05s ease-out" : "transform 0.4s ease-out",
            willChange: "transform",
            cursor: "grab",
            boxShadow: isAuthentic
              ? "0 20px 40px -10px rgba(245, 158, 11, 0.25), 0 0 20px rgba(0, 0, 0, 0.8)"
              : "0 20px 40px -10px rgba(20, 184, 166, 0.25), 0 0 20px rgba(0, 0, 0, 0.8)",
            overflow: "hidden",
            border: isAuthentic
              ? "1px solid rgba(245, 158, 11, 0.5)"
              : "1px solid rgba(20, 184, 166, 0.5)",
            background: isAuthentic
              ? "linear-gradient(135deg, #1e1b18 0%, #2b1f0d 50%, #151006 100%)"
              : "linear-gradient(135deg, #091c1b 0%, #082d2c 50%, #051413 100%)",
          }}
        >
          {/* Iridescent Rainbow Foil Gradient Overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: isVoidToggled ? 0.2 : 0.85,
              background: `conic-gradient(
                from ${rotateX * 4}deg at ${glarePosition.x}% ${glarePosition.y}%,
                rgba(255, 0, 128, 0.25),
                rgba(0, 255, 255, 0.35),
                rgba(255, 215, 0, 0.4),
                rgba(0, 255, 128, 0.25),
                rgba(128, 0, 255, 0.35),
                rgba(255, 0, 128, 0.25)
              )`,
              mixBlendMode: "color-dodge",
              pointerEvents: "none",
              transition: "opacity 0.3s ease",
            }}
          />

          {/* Specular White Glare Spot */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 60%)`,
              mixBlendMode: "overlay",
              pointerEvents: "none",
            }}
          />

          {/* Destructive VOID Pattern Layer when simulated */}
          {isVoidToggled && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  rgba(239, 68, 68, 0.25),
                  rgba(239, 68, 68, 0.25) 15px,
                  rgba(0, 0, 0, 0.7) 15px,
                  rgba(0, 0, 0, 0.7) 30px
                )`,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-around",
                padding: "10px",
                overflow: "hidden",
                zIndex: 3,
                pointerEvents: "none",
              }}
            >
              {Array.from({ length: 16 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "14px",
                    fontWeight: 900,
                    letterSpacing: "0.2em",
                    color: "rgba(239, 68, 68, 0.9)",
                    textShadow: "0 0 6px #ef4444",
                    transform: "rotate(-25deg)",
                  }}
                >
                  VOID OPENED
                </span>
              ))}
            </div>
          )}

          {/* Hologram Card Face Elements */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              zIndex: 2,
              color: "#ffffff",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            }}
          >
            {/* Top Row: Emblems & Tier Title */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isAuthentic ? "#f59e0b" : "#14b8a6"}>
                  <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                </svg>
                <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  NCAMART AUTHENTICITY SEAL
                </span>
              </div>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#e2e8f0",
                }}
              >
                QC CERTIFIED
              </span>
            </div>

            {/* Center: Serialized Crockford Base32 ID */}
            <div style={{ textAlign: "center", margin: "4px 0" }}>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 900,
                  letterSpacing: "0.15em",
                  fontFamily: "monospace",
                  color: isAuthentic ? "#fef08a" : "#5eead4",
                  textShadow: isAuthentic
                    ? "0 0 10px rgba(245, 158, 11, 0.6)"
                    : "0 0 10px rgba(20, 184, 166, 0.6)",
                }}
              >
                {sealId}
              </div>
              <div style={{ fontSize: "10px", color: "#cbd5e1", letterSpacing: "0.05em", marginTop: "2px" }}>
                CROCKFORD BASE32 SERIAL NUMBER
              </div>
            </div>

            {/* Bottom Row: Micro QR and Nawabpur Verification Note */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", fontSize: "10px" }}>
              <div>
                <div style={{ fontWeight: 700, color: "#f8fafc" }}>Nawabpur Complex Hub</div>
                <div style={{ color: "#94a3b8" }}>Scan QR or verify at ncamart.com/verify</div>
              </div>

              {/* QR Mock Tile */}
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  backgroundColor: "rgba(255,255,255,0.9)",
                  borderRadius: "4px",
                  padding: "3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundImage: "radial-gradient(#000 35%, transparent 35%)",
                    backgroundSize: "6px 6px",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explainer Section: 4-Step Chain of Custody & Warranty Distinction */}
      {showExplainer && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* 4-Step Visual Journey */}
          <div>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              4-Step Physical Chain of Custody
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "10px",
                marginTop: "10px",
              }}
            >
              {[
                { step: "01", title: "Godown Staging", desc: "Climate-controlled Nawabpur intake" },
                { step: "02", title: "QC Lab Bench", desc: "Oscilloscope voltage load tested" },
                { step: "03", title: "Seal Minting", desc: "Serialized tamper seal bonded" },
                { step: "04", title: "Tracking Active", desc: "Verify live at ncamart.com/verify" },
              ].map((s) => (
                <div
                  key={s.step}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 900, color: "#3b82f6" }}>
                    STEP {s.step}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
                    {s.title}
                  </span>
                  <span style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.4 }}>
                    {s.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Warranty Distinction Tabs: Official Distributor vs NCAMart Replacement */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("official")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: activeTab === "official" ? "rgba(245, 158, 11, 0.15)" : "transparent",
                  color: activeTab === "official" ? "#f59e0b" : "#94a3b8",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Official Distributor Warranty (100% Authentic)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ncamart")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: activeTab === "ncamart" ? "rgba(20, 184, 166, 0.15)" : "transparent",
                  color: activeTab === "ncamart" ? "#14b8a6" : "#94a3b8",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                NCAMart Replacement Guarantee (Budget Smart)
              </button>
            </div>

            <div style={{ marginTop: "12px", fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6 }}>
              {activeTab === "official" ? (
                <div>
                  <p style={{ margin: "0 0 6px 0" }}>
                    Backed by authorized national distributor service centers across Bangladesh (e.g., Anker BD, Ugreen BD, Baseus BD).
                  </p>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", color: "#94a3b8", fontSize: "12px" }}>
                    <span>• Duration: 12 – 24 Months</span>
                    <span>• Official Claim Centers: Motijheel / Uttara / Chittagong</span>
                    <span>• Free NCAMart RMA Liaison Concierge</span>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ margin: "0 0 6px 0" }}>
                    Direct one-to-one replacement service executed directly at Nawabpur Complex Lab within 48–72 hours.
                  </p>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", color: "#94a3b8", fontSize: "12px" }}>
                    <span>• Duration: 3 – 6 Months Direct Replacement</span>
                    <span>• Immediate bench diagnosis at Nawabpur counter</span>
                    <span>• Zero repair waiting time: instant new unit swap</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Direct Verification CTA linking to /verify */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              borderRadius: "10px",
              backgroundColor: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>🔍</span>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                  Have an NCAMart sealed product in your hand?
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Enter the Crockford Base32 ID to view complete lab bench inspection history & warranty expiry.
                </div>
              </div>
            </div>

            <Link
              href={`/verify?q=${encodeURIComponent(sealId)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                transition: "background-color 0.2s ease",
              }}
            >
              <span>Verify Seal Now</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
