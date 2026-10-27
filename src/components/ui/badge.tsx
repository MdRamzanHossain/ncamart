"use client";

import React from "react";

export type BadgeVariant =
  | "authentic"
  | "budget-smart"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "neutral";

export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  pulse?: boolean;
  icon?: React.ReactNode;
}

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  pulse = false,
  icon,
  className = "",
  style,
  ...props
}: BadgeProps) {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case "authentic":
        return {
          background: "var(--tier-authentic-gold-bg)",
          color: "var(--tier-authentic-gold)",
          border: "1px solid var(--tier-authentic-gold-border)",
          boxShadow: pulse ? "var(--tier-authentic-gold-glow)" : "none",
        };
      case "budget-smart":
        return {
          background: "var(--tier-budget-teal-bg)",
          color: "var(--tier-budget-teal)",
          border: "1px solid var(--tier-budget-teal-border)",
          boxShadow: pulse ? "var(--tier-budget-teal-glow)" : "none",
        };
      case "success":
        return {
          background: "var(--color-success-bg)",
          color: "var(--color-success)",
          border: "1px solid var(--color-success-border)",
        };
      case "warning":
        return {
          background: "var(--color-warning-bg)",
          color: "var(--color-warning)",
          border: "1px solid var(--color-warning-border)",
        };
      case "destructive":
        return {
          background: "var(--color-destructive-bg)",
          color: "var(--color-destructive)",
          border: "1px solid var(--color-destructive-border)",
        };
      case "info":
        return {
          background: "var(--color-info-bg)",
          color: "var(--color-info)",
          border: "1px solid var(--color-info-border)",
        };
      case "neutral":
      default:
        return {
          background: "var(--bg-surface-elevated)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border-default)",
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case "sm":
        return {
          height: "22px",
          padding: "0 var(--space-xs)",
          fontSize: "var(--font-size-2xs)",
          borderRadius: "var(--radius-xs)",
        };
      case "lg":
        return {
          height: "30px",
          padding: "0 var(--space-md)",
          fontSize: "var(--font-size-sm)",
          borderRadius: "var(--radius-sm)",
        };
      case "md":
      default:
        return {
          height: "26px",
          padding: "0 var(--space-sm)",
          fontSize: "var(--font-size-xs)",
          borderRadius: "var(--radius-sm)",
        };
    }
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2xs)",
        fontFamily: "var(--font-family-sans)",
        fontWeight: "var(--font-weight-semibold)",
        lineHeight: 1,
        letterSpacing: "0.01em",
        userSelect: "none",
        whiteSpace: "nowrap",
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      className={`${variant === "authentic" && pulse ? "authentic-shimmer-badge" : ""} ${variant === "budget-smart" && pulse ? "budget-smart-glow" : ""} ${className}`}
      {...props}
    >
      {pulse && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "currentColor",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
      )}
      {icon && <span style={{ display: "inline-flex", fontSize: "1em" }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

/**
 * Pre-configured 100% Authentic Dual-Tier Badge with Holographic Gold Stamp
 */
export function AuthenticBadge({ size = "md", pulse = true }: { size?: BadgeSize; pulse?: boolean }) {
  return (
    <Badge variant="authentic" size={size} pulse={pulse}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      100% Authentic
    </Badge>
  );
}

/**
 * Pre-configured Budget Smart (Tested OEM) Dual-Tier Badge with Cyber Teal Glow
 */
export function BudgetSmartBadge({ size = "md", pulse = true }: { size?: BadgeSize; pulse?: boolean }) {
  return (
    <Badge variant="budget-smart" size={size} pulse={pulse}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      Budget Smart (QC Tested)
    </Badge>
  );
}
