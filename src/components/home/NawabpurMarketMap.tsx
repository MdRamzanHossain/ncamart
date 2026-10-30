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

const HUBS: [HubLocation, ...HubLocation[]] = [
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
        padding: "16px 24px 36px",
        maxWidth: "1320px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "11px",
            color: "#d97706",
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "4px",
          }}
        >
          PHYSICAL INFRASTRUCTURE & SOURCING
        </div>
        <h2
          style={{
            fontSize: "clamp(1.35rem, 2.5vw, 1.85rem)",
            fontWeight: "800",
            color: "#0f172a",
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          Nawabpur Tech Corridor Interactive Map
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#475569",
            maxWidth: "680px",
            margin: "6px auto 0",
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
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "24px",
          alignItems: "stretch",
        }}
      >
        {/* Clean Light Architectural Blueprint Map Canvas */}
        <div
          style={{
            background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
            border: "1px solid #cbd5e1",
            borderRadius: "20px",
            height: "420px",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
          }}
        >
          {/* Subtle Blueprint Grid Background */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(37, 99, 235, 0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(37, 99, 235, 0.06) 1px, transparent 1px)
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
              stroke="rgba(217, 119, 6, 0.35)"
              strokeWidth="4"
              strokeDasharray="6 6"
            />
            {/* Sundarban Connector */}
            <path
              d="M 120 100 L 400 320"
              fill="none"
              stroke="rgba(13, 148, 136, 0.3)"
              strokeWidth="3"
            />
            {/* Stadium Market Spur */}
            <path
              d="M 300 340 L 520 220"
              fill="none"
              stroke="rgba(37, 99, 235, 0.25)"
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
              color: "#475569",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              userSelect: "none",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            Nawabpur Electronic District • Sector 1
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "14px",
              right: "16px",
              fontSize: "10.5px",
              fontWeight: "600",
              color: "#475569",
              userSelect: "none",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              padding: "3px 8px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
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
                      ? "#f59e0b"
                      : hub.type === "QC_LAB"
                      ? "#0d9488"
                      : "#2563eb",
                    opacity: isSelected ? 0.55 : 0.25,
                    animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                  }}
                />

                {/* Beacon Core */}
                <div
                  style={{
                    width: isSelected ? "40px" : "32px",
                    height: isSelected ? "40px" : "32px",
                    borderRadius: "50%",
                    backgroundColor: hub.type === "SHOWROOM"
                      ? "#f59e0b"
                      : hub.type === "QC_LAB"
                      ? "#0d9488"
                      : "#2563eb",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isSelected ? "18px" : "15px",
                    boxShadow: isSelected
                      ? "0 0 0 4px rgba(245, 158, 11, 0.25), 0 6px 16px rgba(15, 23, 42, 0.25)"
                      : "0 4px 10px rgba(15, 23, 42, 0.18)",
                    border: "2.5px solid #ffffff",
                    transition: "all 0.2s ease",
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
                    fontSize: "10.5px",
                    fontWeight: "800",
                    color: isSelected ? "#b45309" : "#0f172a",
                    backgroundColor: "#ffffff",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: isSelected ? "1px solid #f59e0b" : "1px solid #cbd5e1",
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
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
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            minHeight: "420px",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* Badge & Type */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: "#fef3c7",
                  color: "#b45309",
                  border: "1px solid #fde68a",
                }}
              >
                {active.badge}
              </span>

              <span style={{ fontSize: "11.5px", color: "#059669", fontWeight: "700" }}>
                ● {active.status}
              </span>
            </div>

            {/* Name & Market Location */}
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "800",
                color: "#0f172a",
                margin: "12px 0 4px",
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
                fontSize: "12.5px",
                color: "#64748b",
                fontWeight: "600",
                marginBottom: "14px",
              }}
            >
              📍 {active.market}
            </div>

            {/* Description */}
            <p
              style={{
                fontSize: "13.5px",
                color: "#475569",
                lineHeight: "1.6",
                margin: 0,
              }}
            >
              {active.description}
            </p>

            {/* Throughput Metric Pill */}
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                borderRadius: "12px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.05em" }}>
                Daily Throughput SLA
              </div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                ⚡ {active.throughput}
              </div>
            </div>
          </div>

          {/* Stepper Timeline: Drop-and-Pack in 24 Hours */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
            <div style={{ fontSize: "10.5px", fontWeight: "800", color: "#b45309", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "10px" }}>
              How Drop-and-Pack Works
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "#0f172a", backgroundColor: "#f8fafc", padding: "8px 4px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                <div style={{ fontWeight: "800" }}>1. Order</div>
                <div style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>Instant</div>
              </div>
              <div style={{ fontSize: "11px", color: "#0f172a", backgroundColor: "#f8fafc", padding: "8px 4px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                <div style={{ fontWeight: "800" }}>2. Runner</div>
                <div style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>&lt; 30 mins</div>
              </div>
              <div style={{ fontSize: "11px", color: "#0f172a", backgroundColor: "#f8fafc", padding: "8px 4px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                <div style={{ fontWeight: "800" }}>3. QC & Seal</div>
                <div style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>Bench tested</div>
              </div>
              <div style={{ fontSize: "11px", color: "#0f172a", backgroundColor: "#f8fafc", padding: "8px 4px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                <div style={{ fontWeight: "800" }}>4. Dispatched</div>
                <div style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>Same day</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
