"use client";

import React, { useState } from "react";

export function MicroAnnouncementBar() {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div
      className="announcement-root"
      style={{
        background: "linear-gradient(90deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#ffffff",
        fontSize: "12px",
        padding: "6px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="announcement-inner"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textAlign: "center",
          color: "#f8fafc",
        }}
      >
        <span
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.22)",
            border: "1px solid rgba(245, 158, 11, 0.45)",
            color: "#fbbf24",
            padding: "2px 7px",
            borderRadius: "4px",
            fontWeight: "800",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            flexShrink: 0,
          }}
        >
          Daily SLA
        </span>

        <span style={{ color: "#f8fafc" }}>
          দুপুর ২:০০ টার পূর্বে অর্ডার করলে ঢাকা সিটিতে আজই ডেলিভারি ·{" "}
          <strong style={{ color: "#ffffff" }}>Orders placed before 2:00 PM ship today inside Dhaka</strong>
        </span>

        <span className="announcement-secondary" style={{ color: "rgba(255, 255, 255, 0.25)" }}>
          |
        </span>

        <span className="announcement-secondary" style={{ color: "#5eead4", fontWeight: "600" }}>
          Direct Nawabpur Complex Import Wholesale Hub
        </span>
      </div>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss banner"
        style={{
          position: "absolute",
          right: "14px",
          top: "50%",
          transform: "translateY(-50%)",
          color: "rgba(255, 255, 255, 0.65)",
          padding: "4px",
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          background: "transparent",
          border: "none",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
