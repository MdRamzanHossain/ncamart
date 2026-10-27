"use client";

import React, { forwardRef, useState } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "authentic-gold"
  | "budget-teal"
  | "outline"
  | "ghost"
  | "destructive";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      onClick,
      style,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newRipple = { x, y, id: Date.now() };

      setRipples((prev) => [...prev, newRipple]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);

      onClick?.(e);
    };

    // Variant Styles
    const getVariantStyles = (): React.CSSProperties => {
      switch (variant) {
        case "authentic-gold":
          return {
            background: "var(--tier-authentic-shimmer)",
            backgroundSize: "200% 200%",
            color: "#0b0f19",
            fontWeight: "var(--font-weight-bold)",
            boxShadow: "var(--tier-authentic-gold-glow)",
            border: "1px solid var(--tier-authentic-gold)",
          };
        case "budget-teal":
          return {
            background: "var(--tier-budget-shimmer)",
            backgroundSize: "200% 200%",
            color: "#ffffff",
            fontWeight: "var(--font-weight-bold)",
            boxShadow: "var(--tier-budget-teal-glow)",
            border: "1px solid var(--tier-budget-teal)",
          };
        case "secondary":
          return {
            backgroundColor: "var(--bg-surface-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          };
        case "outline":
          return {
            backgroundColor: "transparent",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          };
        case "ghost":
          return {
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid transparent",
          };
        case "destructive":
          return {
            backgroundColor: "var(--color-destructive)",
            color: "#ffffff",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.35)",
            border: "1px solid transparent",
          };
        case "primary":
        default:
          return {
            backgroundColor: "var(--color-brand-primary)",
            color: "#ffffff",
            boxShadow: "0 4px 14px var(--color-brand-primary-glow)",
            border: "1px solid transparent",
          };
      }
    };

    // Size Styles
    const getSizeStyles = (): React.CSSProperties => {
      switch (size) {
        case "sm":
          return {
            height: "34px",
            padding: "0 var(--space-md)",
            fontSize: "var(--font-size-sm)",
            borderRadius: "var(--radius-sm)",
          };
        case "lg":
          return {
            height: "50px",
            padding: "0 var(--space-2xl)",
            fontSize: "var(--font-size-lg)",
            borderRadius: "var(--radius-lg)",
          };
        case "icon":
          return {
            width: "42px",
            height: "42px",
            padding: 0,
            borderRadius: "var(--radius-md)",
          };
        case "md":
        default:
          return {
            height: "42px",
            padding: "0 var(--space-xl)",
            fontSize: "var(--font-size-base)",
            borderRadius: "var(--radius-md)",
          };
      }
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        onClick={handleClick}
        style={{
          position: "relative",
          overflow: "hidden",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-sm)",
          fontFamily: "var(--font-family-sans)",
          fontWeight: "var(--font-weight-medium)",
          lineHeight: 1,
          letterSpacing: "-0.01em",
          cursor: disabled || isLoading ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "transform var(--duration-fast) var(--ease-spring), box-shadow var(--duration-fast) ease, opacity var(--duration-fast) ease",
          ...getVariantStyles(),
          ...getSizeStyles(),
          ...style,
        }}
        className={`interactive-scale ${className}`}
        {...props}
      >
        {/* Ripple Overlays */}
        {ripples.map((r) => (
          <span
            key={r.id}
            style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              transform: "translate(-50%, -50%)",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.35)",
              animation: "ripple 0.6s linear forwards",
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Loading Spinner */}
        {isLoading && (
          <svg
            style={{
              width: "18px",
              height: "18px",
              animation: "spin 0.8s linear infinite",
            }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="30"
              strokeLinecap="round"
              opacity="0.3"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        )}

        {!isLoading && leftIcon && <span style={{ display: "inline-flex" }}>{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span style={{ display: "inline-flex" }}>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
