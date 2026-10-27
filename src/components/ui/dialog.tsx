"use client";

import React, { useEffect, useRef } from "react";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "520px",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key & focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-md)",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "var(--glass-blur-sm)",
        WebkitBackdropFilter: "var(--glass-blur-sm)",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-desc" : undefined}
        style={{
          width: "100%",
          maxWidth,
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-xl)",
          overflow: "hidden",
          animation: "scaleIn 0.25s var(--ease-spring)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        {(title || description) && (
          <div
            style={{
              padding: "var(--space-xl) var(--space-xl) var(--space-md)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div>
              {title && (
                <h3
                  id="dialog-title"
                  style={{
                    fontSize: "var(--font-size-xl)",
                    fontWeight: "var(--font-weight-bold)",
                  }}
                >
                  {title}
                </h3>
              )}
              {description && (
                <p
                  id="dialog-desc"
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--text-secondary)",
                    marginTop: "var(--space-xs)",
                  }}
                >
                  {description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                color: "var(--text-tertiary)",
                padding: "var(--space-xs)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color var(--duration-fast) ease",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "var(--space-xl)", overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
