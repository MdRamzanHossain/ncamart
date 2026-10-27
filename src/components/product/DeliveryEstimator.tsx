"use client";

import React, { useState } from "react";
import { formatPaisa } from "@/lib/money";

interface DivisionInfo {
  name: string;
  districts: string[];
  baseFeePaisa: number;
  slaHours: string;
  courier: string;
}

const BANGLADESH_DIVISIONS: Record<string, DivisionInfo> = {
  Dhaka: {
    name: "Dhaka",
    districts: ["Dhaka City", "Gazipur", "Narayanganj", "Savar", "Tangail", "Narsingdi", "Manikganj"],
    baseFeePaisa: 6000, // ৳60
    slaHours: "Within 24 Hours",
    courier: "Pathao / Steadfast Express",
  },
  Chittagong: {
    name: "Chittagong",
    districts: ["Chittagong City", "Cox's Bazar", "Comilla", "Feni", "Brahmanbaria", "Noakhali"],
    baseFeePaisa: 12000, // ৳120
    slaHours: "48 – 72 Hours",
    courier: "Steadfast Express",
  },
  Rajshahi: {
    name: "Rajshahi",
    districts: ["Rajshahi City", "Bogra", "Pabna", "Sirajganj", "Naogaon", "Natore"],
    baseFeePaisa: 12000, // ৳120
    slaHours: "48 – 72 Hours",
    courier: "Steadfast Express",
  },
  Khulna: {
    name: "Khulna",
    districts: ["Khulna City", "Jessore", "Kushtia", "Satkhira", "Bagerhat"],
    baseFeePaisa: 12000, // ৳120
    slaHours: "48 – 72 Hours",
    courier: "Steadfast Express",
  },
  Sylhet: {
    name: "Sylhet",
    districts: ["Sylhet City", "Moulvibazar", "Habiganj", "Sunamganj"],
    baseFeePaisa: 12000, // ৳120
    slaHours: "48 – 72 Hours",
    courier: "Steadfast Express",
  },
  Barisal: {
    name: "Barisal",
    districts: ["Barisal City", "Bhola", "Patuakhali", "Pirojpur", "Jhalokati", "Barguna"],
    baseFeePaisa: 13000, // ৳130
    slaHours: "48 – 72 Hours",
    courier: "Steadfast Express",
  },
  Rangpur: {
    name: "Rangpur",
    districts: ["Rangpur City", "Dinajpur", "Gaibandha", "Kurigram", "Nilphamari"],
    baseFeePaisa: 13000, // ৳130
    slaHours: "48 – 72 Hours",
    courier: "Steadfast Express",
  },
  Mymensingh: {
    name: "Mymensingh",
    districts: ["Mymensingh City", "Jamalpur", "Netrokona", "Sherpur"],
    baseFeePaisa: 12000, // ৳120
    slaHours: "48 – 72 Hours",
    courier: "Steadfast Express",
  },
};

export function DeliveryEstimator() {
  const [selectedDivision, setSelectedDivision] = useState<string>("Dhaka");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("Dhaka City");

  const currentDivision = BANGLADESH_DIVISIONS[selectedDivision] || BANGLADESH_DIVISIONS.Dhaka;

  const handleDivisionChange = (div: string) => {
    setSelectedDivision(div);
    const targetDiv = BANGLADESH_DIVISIONS[div];
    if (targetDiv && targetDiv.districts.length > 0) {
      setSelectedDistrict(targetDiv.districts[0]);
    }
  };

  return (
    <div
      style={{
        borderRadius: "12px",
        backgroundColor: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          <span>Delivery & Courier SLA Calculator</span>
        </div>
        <span style={{ fontSize: "11px", color: "#94a3b8", backgroundColor: "rgba(255, 255, 255, 0.05)", padding: "2px 8px", borderRadius: "10px" }}>
          Nawabpur Hub Dispatch
        </span>
      </div>

      {/* Selector Dropdowns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
            Division
          </label>
          <select
            value={selectedDivision}
            onChange={(e) => handleDivisionChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "8px",
              backgroundColor: "#0d131f",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#f8fafc",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {Object.keys(BANGLADESH_DIVISIONS).map((div) => (
              <option key={div} value={div}>
                {div}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
            District / Area
          </label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "8px",
              backgroundColor: "#0d131f",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#f8fafc",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {currentDivision.districts.map((dist) => (
              <option key={dist} value={dist}>
                {dist}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calculated Result Card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderRadius: "8px",
          backgroundColor: "rgba(59, 130, 246, 0.08)",
          border: "1px solid rgba(59, 130, 246, 0.25)",
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
            {selectedDistrict}, {selectedDivision}:{" "}
            <span style={{ color: "#38bdf8" }}>
              {formatPaisa(currentDivision.baseFeePaisa)}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
            Delivered {currentDivision.slaHours} via {currentDivision.courier}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span
            style={{
              display: "inline-block",
              padding: "3px 8px",
              borderRadius: "4px",
              backgroundColor: "#10b981",
              color: "#022c22",
              fontSize: "10px",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            Verified SLA
          </span>
        </div>
      </div>

      {/* Physical Showroom Pickup Option */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#cbd5e1",
          padding: "6px 8px",
        }}
      >
        <span style={{ color: "#f59e0b", fontSize: "14px" }}>🏬</span>
        <span>
          <strong>Free Same-Day Storefront Pickup:</strong> Counter #42, Nawabpur Complex, 224 Nawabpur Road (10am – 8pm).
        </span>
      </div>
    </div>
  );
}
