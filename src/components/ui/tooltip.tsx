"use client";

import React, { useState } from "react";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delayMs?: number;
}

export function Tooltip({
  content,
  children,
  position = "top",
  delayMs = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const t = setTimeout(() => setIsVisible(true), delayMs);
    setTimer(t);
  };

  const handleMouseLeave = () => {
    if (timer) clearTimeout(timer);
    setIsVisible(false);
  };

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case "bottom":
        return {
          top: "100%",
          left: "50%",
          transform: "translateX(-50%) translateY(6px)",
        };
      case "left":
        return {
          top: "50%",
          right: "100%",
          transform: "translateY(-50%) translateX(-6px)",
        };
      case "right":
        return {
          top: "50%",
          left: "100%",
          transform: "translateY(-50%) translateX(6px)",
        };
      case "top":
      default:
        return {
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%) translateY(-6px)",
        };
    }
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      style={{ position: "relative", display: "inline-flex" }}
    >
      {children}

      {isVisible && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 900,
            whiteSpace: "nowrap",
            backgroundColor: "var(--neutral-900)",
            color: "var(--neutral-50)",
            fontSize: "var(--font-size-2xs)",
            fontWeight: "var(--font-weight-medium)",
            padding: "var(--space-2xs) var(--space-sm)",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-md)",
            pointerEvents: "none",
            animation: "fadeIn 0.15s var(--ease-spring)",
            ...getPositionStyles(),
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
