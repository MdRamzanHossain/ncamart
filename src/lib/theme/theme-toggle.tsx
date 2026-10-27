"use client";

import React from "react";
import { useTheme } from "./theme-context";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme selection"
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-full)",
        padding: "var(--space-2xs)",
        gap: "var(--space-2xs)",
      }}
      className={className}
    >
      {/* Light Option */}
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Switch to Light mode"
        aria-pressed={theme === "light"}
        title="Light Mode"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          borderRadius: "var(--radius-full)",
          backgroundColor: theme === "light" ? "var(--bg-surface-active)" : "transparent",
          color: theme === "light" ? "var(--color-warning)" : "var(--text-tertiary)",
          border: "none",
          cursor: "pointer",
          transition: "all var(--duration-fast) var(--ease-spring)",
          transform: theme === "light" ? "scale(1.05)" : "scale(1)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      </button>

      {/* Dark Option */}
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Switch to Dark mode"
        aria-pressed={theme === "dark"}
        title="Dark Mode"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          borderRadius: "var(--radius-full)",
          backgroundColor: theme === "dark" ? "var(--bg-surface-active)" : "transparent",
          color: theme === "dark" ? "var(--color-brand-primary)" : "var(--text-tertiary)",
          border: "none",
          cursor: "pointer",
          transition: "all var(--duration-fast) var(--ease-spring)",
          transform: theme === "dark" ? "scale(1.05)" : "scale(1)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </button>

      {/* System Option */}
      <button
        type="button"
        onClick={() => setTheme("system")}
        aria-label="Follow System theme"
        aria-pressed={theme === "system"}
        title={`System Mode (${resolvedTheme})`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          borderRadius: "var(--radius-full)",
          backgroundColor: theme === "system" ? "var(--bg-surface-active)" : "transparent",
          color: theme === "system" ? "var(--tier-budget-teal)" : "var(--text-tertiary)",
          border: "none",
          cursor: "pointer",
          transition: "all var(--duration-fast) var(--ease-spring)",
          transform: theme === "system" ? "scale(1.05)" : "scale(1)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Compact Single-Button Quick Cycle Toggle (Sun -> Moon -> Laptop)
 */
export function ThemeCycleButton({ className = "" }: { className?: string }) {
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Current theme: ${theme}. Click to cycle.`}
      title={`Theme: ${theme} (resolved: ${resolvedTheme})`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        borderRadius: "var(--radius-full)",
        backgroundColor: "var(--glass-bg)",
        border: "1px solid var(--border-default)",
        backdropFilter: "var(--glass-blur-sm)",
        WebkitBackdropFilter: "var(--glass-blur-sm)",
        color: "var(--text-primary)",
        cursor: "pointer",
        transition: "all var(--duration-fast) var(--ease-spring)",
      }}
      className={`interactive-scale ${className}`}
    >
      {theme === "light" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      )}
      {theme === "dark" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
      {theme === "system" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tier-budget-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      )}
    </button>
  );
}
