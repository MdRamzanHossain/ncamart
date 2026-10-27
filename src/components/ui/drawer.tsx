"use client";

import React, { useEffect, useRef } from "react";

export type DrawerPosition = "right" | "bottom";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: DrawerPosition;
  size?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = "right",
  size = "420px",
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isBottom = position === "bottom";

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "var(--glass-blur-sm)",
        WebkitBackdropFilter: "var(--glass-blur-sm)",
        display: "flex",
        justifyContent: isBottom ? "center" : "flex-end",
        alignItems: isBottom ? "flex-end" : "stretch",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
        style={{
          width: isBottom ? "100%" : size,
          maxWidth: "100%",
          maxHeight: isBottom ? "85vh" : "100vh",
          backgroundColor: "var(--bg-surface)",
          borderLeft: isBottom ? "none" : "1px solid var(--border-default)",
          borderTop: isBottom ? "1px solid var(--border-default)" : "none",
          borderTopLeftRadius: isBottom ? "var(--radius-2xl)" : 0,
          borderTopRightRadius: isBottom ? "var(--radius-2xl)" : 0,
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          animation: isBottom ? "slideUp 0.3s var(--ease-spring)" : "slideLeft 0.3s var(--ease-spring)",
        }}
      >
        {/* Mobile Pull Indicator */}
        {isBottom && (
          <div
            style={{
              width: "48px",
              height: "4px",
              backgroundColor: "var(--neutral-600)",
              borderRadius: "var(--radius-full)",
              margin: "var(--space-sm) auto var(--space-xs)",
            }}
          />
        )}

        {/* Header */}
        <div
          style={{
            padding: "var(--space-lg) var(--space-xl)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {title && (
            <h3
              id="drawer-title"
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-bold)",
              }}
            >
              {title}
            </h3>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              color: "var(--text-tertiary)",
              padding: "var(--space-xs)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: "auto",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "var(--space-xl)", overflowY: "auto", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
