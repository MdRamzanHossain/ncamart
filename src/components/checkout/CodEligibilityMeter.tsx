"use client";

import React from "react";
import { formatPaisa } from "@/lib/money";

export type CodStatus = "FULL_COD" | "ADVANCE_FEE_REQUIRED" | "COD_BLOCKED";

export interface CodEligibilityMeterProps {
  status: CodStatus;
  advanceFeePaisa?: number;
  rtoCount?: number;
  deliveredCount?: number;
}

export function CodEligibilityMeter({
  status,
  advanceFeePaisa = 12000, // ৳120 default advance fee
  rtoCount = 0,
  deliveredCount = 0,
}: CodEligibilityMeterProps) {
  return (
    <div
      style={{
        borderRadius: "12px",
        padding: "16px",
        backgroundColor:
          status === "FULL_COD"
            ? "rgba(16, 185, 129, 0.08)"
            : status === "ADVANCE_FEE_REQUIRED"
            ? "rgba(59, 130, 246, 0.08)"
            : "rgba(239, 68, 68, 0.08)",
        border:
          status === "FULL_COD"
            ? "1px solid rgba(16, 185, 129, 0.3)"
            : status === "ADVANCE_FEE_REQUIRED"
            ? "1px solid rgba(59, 130, 246, 0.3)"
            : "1px solid rgba(239, 68, 68, 0.3)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Status Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>
            {status === "FULL_COD" ? "🛡️" : status === "ADVANCE_FEE_REQUIRED" ? "ℹ️" : "⚠️"}
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 800,
              color:
                status === "FULL_COD"
                  ? "#10b981"
                  : status === "ADVANCE_FEE_REQUIRED"
                  ? "#38bdf8"
                  : "#ef4444",
            }}
          >
            {status === "FULL_COD"
              ? "Verified Buyer — 100% Full COD Unlocked"
              : status === "ADVANCE_FEE_REQUIRED"
              ? "First-Time Buyer COD Policy"
              : "Cash on Delivery Unavailable for this Account"}
          </span>
        </div>

        {/* Meter Pill */}
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "6px",
            backgroundColor:
              status === "FULL_COD"
                ? "rgba(16, 185, 129, 0.2)"
                : status === "ADVANCE_FEE_REQUIRED"
                ? "rgba(59, 130, 246, 0.2)"
                : "rgba(239, 68, 68, 0.2)",
            color:
              status === "FULL_COD"
                ? "#10b981"
                : status === "ADVANCE_FEE_REQUIRED"
                ? "#38bdf8"
                : "#ef4444",
          }}
        >
          {status === "FULL_COD"
            ? `${deliveredCount} Delivered Orders`
            : status === "ADVANCE_FEE_REQUIRED"
            ? "First Order"
            : `${rtoCount} Past Returns`}
        </span>
      </div>

      {/* Explanation Text */}
      <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1", lineHeight: 1.5 }}>
        {status === "FULL_COD" ? (
          "Thank you for being a trusted NCAMart customer. You can pay 100% of your order total in cash when inspecting the sealed package at your doorstep."
        ) : status === "ADVANCE_FEE_REQUIRED" ? (
          <>
            To confirm your COD order, a small advance delivery fee of{" "}
            <strong style={{ color: "#38bdf8" }}>{formatPaisa(advanceFeePaisa)}</strong> is
            required to cover courier dispatch booking. The remaining balance is payable at your doorstep upon delivery.
          </>
        ) : (
          "Cash on Delivery is unavailable for this account due to multiple previous courier return (RTO) incidents. Please pay securely via bKash, Nagad, or credit card."
        )}
      </p>

      {/* Trust Footer Note */}
      <div style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
        <span>🔒 Nawabpur Fraud-Prevention Standard (PRD §3.12)</span>
        <span>•</span>
        <span>Holographic Seal Warranty Guaranteed</span>
      </div>
    </div>
  );
}
