"use client";

import React, { useState } from "react";

export function MicroAnnouncementBar() {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div
      className="announcement-root"
      style={{
        background: "linear-gradient(90deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        color: "var(--text-primary)",
        fontSize: "var(--font-size-xs)",
        padding: "var(--space-2xs) var(--space-xl)",
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
          gap: "var(--space-md)",
          textAlign: "center",
        }}
      >
        <span
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.2)",
            color: "var(--tier-authentic-gold)",
            padding: "1px 6px",
            borderRadius: "var(--radius-xs)",
            fontWeight: "var(--font-weight-bold)",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            flexShrink: 0,
          }}
        >
          Daily SLA
        </span>

        <span>
          দুপুর ২:০০ টার পূর্বে অর্ডার করলে ঢাকা সিটিতে আজই ডেলিভারি · <strong>Orders placed before 2:00 PM ship today inside Dhaka</strong>
        </span>

        <span className="announcement-secondary" style={{ color: "var(--border-strong)" }}>|</span>

        <span className="announcement-secondary" style={{ color: "var(--tier-budget-teal)" }}>
          Direct Nawabpur Complex Import Wholesale Hub
        </span>
      </div>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss banner"
        style={{
          position: "absolute",
          right: "var(--space-md)",
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--text-tertiary)",
          padding: "2px",
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
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
