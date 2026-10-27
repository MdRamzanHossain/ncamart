"use client";

import React, { useState } from "react";

interface HubLocation {
  id: string;
  name: string;
  market: string;
  xPercent: number;
  yPercent: number;
  type: "SHOWROOM" | "GODOWN" | "QC_LAB" | "RUNNER_RELAY";
  badge: string;
  status: string;
  throughput: string;
  description: string;
  icon: string;
}

const HUBS: HubLocation[] = [
  {
    id: "hub-showroom",
    name: "Showroom & Pickup Counter",
    market: "Shop 42, Nawabpur Complex",
    xPercent: 38,
    yPercent: 42,
    type: "SHOWROOM",
    badge: "Public Counter",
    status: "OPEN (10 AM - 8 PM)",
    throughput: "Walk-ins & 6-Digit PIN Handover",
    description: "Physical counter where buyers inspect goods on testing bench with engineers before collection.",
    icon: "🏪",
  },
  {
    id: "hub-godown",
    name: "Central Godown & Packing Hub",
    market: "Sundarban Square Market, Level 4",
    xPercent: 62,
    yPercent: 32,
    type: "GODOWN",
    badge: "Fulfillment Core",
    status: "ACTIVE (24/7 Operations)",
    throughput: "600+ Parcels Dispatched Daily",
    description: "High-density ESD-safe racks housing 100% verified authentic stock and tested OEM supplies.",
    icon: "📦",
  },
  {
    id: "hub-qc",
    name: "QC & Holographic Minting Center",
    market: "Nawabpur Tower, Level 2",
    xPercent: 50,
    yPercent: 65,
    type: "QC_LAB",
    badge: "Trust Engine",
    status: "3 Inspection Techs On Duty",
    throughput: "100% Destructive Seal Application",
    description: "Laser barcode scanners, 100W electronic loads, and thermal cameras testing incoming distributor lots.",
    icon: "🔬",
  },
  {
    id: "hub-runners",
    name: "Wholesale Runner Relay Hub",
    market: "Stadium Market Alleys & Stalls",
    xPercent: 78,
    yPercent: 55,
    type: "RUNNER_RELAY",
    badge: "Field Runners",
    status: "On Shift (Every 15 mins)",
    throughput: "Same-Day Drop-and-Pack",
    description: "Motorbike and foot runners sourcing pre-ordered items directly from master importer stalls.",
    icon: "🏃‍♂️",
  },
];

export function NawabpurMarketMap() {
  const [selectedHub, setSelectedHub] = useState<HubLocation>(HUBS[0]);
  const [hoveredHub, setHoveredHub] = useState<HubLocation | null>(null);

  const active = hoveredHub || selectedHub;

  return (
    <section
      aria-label="Nawabpur Tech Corridor Interactive Map"
      style={{
        padding: "var(--space-2xl) var(--space-md)",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "var(--space-xl)" }}>
        <div
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--tier-authentic-gold)",
            fontWeight: "var(--font-weight-bold)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "4px",
          }}
        >
          PHYSICAL INFRASTRUCTURE & SOURCING
        </div>
        <h2
          style={{
            fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
            fontWeight: "800",
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.03em",
          }}
        >
          Nawabpur Tech Corridor Interactive Map
        </h2>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--text-secondary)",
            maxWidth: "680px",
            margin: "var(--space-xs) auto 0",
          }}
        >
          See how our field runners and QC technicians verify, seal, and pack wholesale tech accessories
          directly from Bangladesh&apos;s largest electronics district.
        </p>
      </div>

      {/* Main Grid: Interactive Map + Location Inspector Card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--space-xl)",
          alignItems: "center",
        }}
      >
        {/* Stylized Dark Mode Map Canvas */}
        <div
          style={{
            backgroundColor: "var(--bg-canvas)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xl)",
            height: "420px",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Subtle Grid Roads Background */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(245, 158, 11, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(20, 184, 166, 0.05) 1px, transparent 1px)
              `,
              backgroundSize: "32px 32px",
            }}
          />

          {/* Stylized Street Lines */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            {/* Nawabpur Main Road */}
            <path
              d="M 50 380 Q 200 240 320 200 T 550 80"
              fill="none"
              stroke="rgba(245, 158, 11, 0.25)"
              strokeWidth="4"
              strokeDasharray="6 6"
            />
            {/* Sundarban Connector */}
            <path
              d="M 120 100 L 400 320"
              fill="none"
              stroke="rgba(20, 184, 166, 0.2)"
              strokeWidth="3"
            />
            {/* Stadium Market Spur */}
            <path
              d="M 300 340 L 520 220"
              fill="none"
              stroke="rgba(56, 189, 248, 0.2)"
              strokeWidth="2.5"
            />
          </svg>

          {/* Area Labels on Map */}
          <div
            style={{
              position: "absolute",
              top: "14px",
              left: "16px",
              fontSize: "11px",
              fontWeight: "800",
              color: "var(--text-tertiary)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              userSelect: "none",
            }}
          >
            Nawabpur Electronic District • Sector 1
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "14px",
              right: "16px",
              fontSize: "10px",
              color: "var(--text-tertiary)",
              userSelect: "none",
            }}
          >
            Coordinates: 23.7196° N, 90.4109° E
          </div>

          {/* Pulse Beacons */}
          {HUBS.map((hub) => {
            const isSelected = active.id === hub.id;

            return (
              <button
                key={hub.id}
                type="button"
                onClick={() => setSelectedHub(hub)}
                onMouseEnter={() => setHoveredHub(hub)}
                onMouseLeave={() => setHoveredHub(null)}
                style={{
                  position: "absolute",
                  left: `${hub.xPercent}%`,
                  top: `${hub.yPercent}%`,
                  transform: "translate(-50%, -50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "10px",
                  zIndex: isSelected ? 20 : 10,
                }}
                aria-label={`Select ${hub.name}`}
              >
                {/* Ping Animation Ring */}
                <span
                  style={{
                    position: "absolute",
                    inset: "4px",
                    borderRadius: "50%",
                    backgroundColor: hub.type === "SHOWROOM"
                      ? "var(--tier-authentic-gold)"
                      : hub.type === "QC_LAB"
                      ? "var(--tier-budget-teal)"
                      : "#38bdf8",
                    opacity: isSelected ? 0.6 : 0.25,
                    animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                  }}
                />

                {/* Beacon Core */}
                <div
                  style={{
                    width: isSelected ? "38px" : "30px",
                    height: isSelected ? "38px" : "30px",
                    borderRadius: "50%",
                    backgroundColor: hub.type === "SHOWROOM"
                      ? "var(--tier-authentic-gold)"
                      : hub.type === "QC_LAB"
                      ? "var(--tier-budget-teal)"
                      : "#38bdf8",
                    color: "#0b0f19",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isSelected ? "18px" : "14px",
                    boxShadow: isSelected
                      ? "0 0 20px rgba(245, 158, 11, 0.8), 0 4px 12px rgba(0, 0, 0, 0.4)"
                      : "0 0 10px rgba(0, 0, 0, 0.5)",
                    border: "2px solid #ffffff",
                    transition: "all var(--duration-fast) var(--ease-spring)",
                    position: "relative",
                  }}
                >
                  {hub.icon}
                </div>

                {/* Micro Label */}
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    fontSize: "10px",
                    fontWeight: "800",
                    color: isSelected ? "var(--tier-authentic-gold)" : "var(--text-primary)",
                    backgroundColor: "rgba(11, 15, 25, 0.85)",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-xs)",
                    border: "1px solid var(--border-subtle)",
                    marginTop: "4px",
                    pointerEvents: "none",
                  }}
                >
                  {hub.name.split(" ")[0]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Hub Inspector Card */}
        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-xl)",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
            minHeight: "420px",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* Badge & Type */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "3px 8px",
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: "var(--tier-authentic-gold-bg)",
                  color: "var(--tier-authentic-gold)",
                  border: "1px solid var(--tier-authentic-gold-border)",
                }}
              >
                {active.badge}
              </span>

              <span style={{ fontSize: "11px", color: "var(--color-status-success)", fontWeight: "700" }}>
                ● {active.status}
              </span>
            </div>

            {/* Name & Market Location */}
            <h3
              style={{
                fontSize: "var(--font-size-xl)",
                fontWeight: "900",
                color: "var(--text-primary)",
                margin: "var(--space-sm) 0 4px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{active.icon}</span>
              <span>{active.name}</span>
            </h3>

            <div
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--text-tertiary)",
                fontWeight: "600",
                marginBottom: "var(--space-md)",
              }}
            >
              📍 {active.market}
            </div>

            {/* Description */}
            <p
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--text-secondary)",
                lineHeight: "1.6",
                margin: 0,
              }}
            >
              {active.description}
            </p>

            {/* Throughput Metric Pill */}
            <div
              style={{
                marginTop: "var(--space-md)",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: "700" }}>
                Daily Throughput SLA
              </div>
              <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "800", color: "var(--text-primary)", marginTop: "2px" }}>
                ⚡ {active.throughput}
              </div>
            </div>
          </div>

          {/* Stepper Timeline: Drop-and-Pack in 24 Hours */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-md)" }}>
            <div style={{ fontSize: "10px", fontWeight: "800", color: "var(--tier-authentic-gold)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "8px" }}>
              How Drop-and-Pack Works
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "var(--text-primary)" }}>
                <div style={{ fontWeight: "800" }}>1. Order</div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "9px" }}>Instant</div>
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-primary)" }}>
                <div style={{ fontWeight: "800" }}>2. Runner</div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "9px" }}>&lt; 30 mins</div>
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-primary)" }}>
                <div style={{ fontWeight: "800" }}>3. QC & Seal</div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "9px" }}>Bench tested</div>
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-primary)" }}>
                <div style={{ fontWeight: "800" }}>4. Dispatched</div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "9px" }}>Same day</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
