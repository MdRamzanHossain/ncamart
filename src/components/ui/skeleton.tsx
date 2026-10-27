"use client";

import React from "react";

export type SkeletonVariant = "text" | "rectangular" | "circular" | "card" | "table-row";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  lines = 1,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case "circular":
        return {
          width: width ?? "40px",
          height: height ?? "40px",
          borderRadius: "var(--radius-full)",
        };
      case "card":
        return {
          width: width ?? "100%",
          height: height ?? "220px",
          borderRadius: "var(--radius-xl)",
        };
      case "table-row":
        return {
          width: width ?? "100%",
          height: height ?? "48px",
          borderRadius: "var(--radius-sm)",
        };
      case "rectangular":
        return {
          width: width ?? "100%",
          height: height ?? "100px",
          borderRadius: "var(--radius-md)",
        };
      case "text":
      default:
        return {
          width: width ?? "100%",
          height: height ?? "16px",
          borderRadius: "var(--radius-xs)",
        };
    }
  };

  const baseStyle: React.CSSProperties = {
    background: "linear-gradient(90deg, var(--neutral-800) 0%, var(--neutral-700) 50%, var(--neutral-800) 100%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.8s ease-in-out infinite",
    border: "1px solid var(--border-subtle)",
    ...getVariantStyles(),
    ...style,
  };

  if (variant === "text" && lines > 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", width: "100%" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              ...baseStyle,
              width: i === lines - 1 ? "75%" : "100%",
            }}
            className={className}
            {...props}
          />
        ))}
      </div>
    );
  }

  return <div style={baseStyle} className={className} {...props} />;
}
