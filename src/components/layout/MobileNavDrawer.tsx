"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/lib/theme";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchClick?: () => void;
}

const MOBILE_CATEGORIES = [
  {
    name: "Engineering & Soldering Tools",
    slug: "engineering-tools",
    icon: "🔧",
    authenticCount: 142,
    budgetCount: 88,
  },
  {
    name: "GaN Chargers & High-Power Adapters",
    slug: "chargers-power",
    icon: "⚡",
    authenticCount: 96,
    budgetCount: 45,
  },
  {
    name: "Smart Wearables & Tech",
    slug: "smart-wearables",
    icon: "⌚",
    authenticCount: 64,
    budgetCount: 30,
  },
  {
    name: "Industrial Utility & High-Speed Cables",
    slug: "cables-adapters",
    icon: "🔌",
    authenticCount: 110,
    budgetCount: 75,
  },
  {
    name: "CCTV, Security & Optical Surveillance",
    slug: "cctv-surveillance",
    icon: "📹",
    authenticCount: 80,
    budgetCount: 40,
  },
];

export function MobileNavDrawer({ isOpen, onClose, onSearchClick }: MobileNavDrawerProps) {
  const { customer, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Drawer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-index-modal)",
        display: "flex",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
        animation: "fadeIn var(--duration-fast) ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "82%",
          maxWidth: "340px",
          height: "100%",
          backgroundColor: "var(--bg-surface)",
          borderRight: "1px solid var(--border-default)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "10px 0 30px rgba(0, 0, 0, 0.5)",
          animation: "slideLeft var(--duration-fast) cubic-bezier(0.16, 1, 0.3, 1)",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: "var(--space-md)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-surface-elevated)",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "var(--radius-sm)",
                background: "linear-gradient(135deg, #0b0f19 0%, #0d9488 100%)",
                border: "1px solid var(--tier-authentic-gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: "900",
                fontSize: "14px",
              }}
            >
              N
            </div>
            <span style={{ fontWeight: "800", fontSize: "16px", color: "var(--text-primary)" }}>
              NCA<span style={{ color: "var(--color-brand-primary)" }}>MART</span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ThemeToggle />
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                padding: "4px",
              }}
              aria-label="Close navigation"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search Quick Button in Mobile Drawer */}
        <div style={{ padding: "var(--space-sm) var(--space-md)" }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onSearchClick) onSearchClick();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              backgroundColor: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-tertiary)",
              fontSize: "var(--font-size-sm)",
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Search products or brands...</span>
          </button>
        </div>

        {/* Dual-Tier Switcher Banner */}
        <div style={{ padding: "0 var(--space-md) var(--space-sm)" }}>
          <div
            style={{
              display: "flex",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-surface-elevated)",
              padding: "3px",
              border: "1px solid var(--border-subtle)",
              gap: "4px",
            }}
          >
            <Link
              href="/catalog?tier=AUTHENTIC"
              onClick={onClose}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "6px 4px",
                fontSize: "11px",
                fontWeight: "700",
                textDecoration: "none",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--tier-authentic-gold-bg)",
                color: "var(--tier-authentic-gold)",
                border: "1px solid var(--tier-authentic-gold-border)",
              }}
            >
              ✨ Authentic
            </Link>
            <Link
              href="/catalog?tier=BUDGET_SMART"
              onClick={onClose}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "6px 4px",
                fontSize: "11px",
                fontWeight: "700",
                textDecoration: "none",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--tier-budget-teal-bg)",
                color: "var(--tier-budget-teal)",
                border: "1px solid var(--tier-budget-teal-border)",
              }}
            >
              ⚡ Budget Smart
            </Link>
          </div>
        </div>

        {/* Category List */}
        <div style={{ flex: 1, padding: "var(--space-xs) var(--space-md)" }}>
          <div
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: "700",
              color: "var(--text-tertiary)",
              padding: "4px 8px",
            }}
          >
            Categories
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {MOBILE_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 8px",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  color: "var(--text-primary)",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: "var(--font-weight-medium)",
                  transition: "background var(--duration-fast) ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <span
                    style={{
                      fontSize: "9px",
                      padding: "1px 4px",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: "var(--tier-authentic-gold-bg)",
                      color: "var(--tier-authentic-gold)",
                      fontWeight: "700",
                    }}
                  >
                    {cat.authenticCount}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      padding: "1px 4px",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: "var(--tier-budget-teal-bg)",
                      color: "var(--tier-budget-teal)",
                      fontWeight: "700",
                    }}
                  >
                    {cat.budgetCount}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Quick Shortcuts */}
          <div
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: "700",
              color: "var(--text-tertiary)",
              padding: "16px 8px 4px",
            }}
          >
            Services & Account
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <Link
              href="/verify"
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 8px",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                color: "var(--tier-authentic-gold)",
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-bold)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Holographic Seal Verify</span>
            </Link>

            <Link
              href="/track"
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 8px",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                color: "var(--text-secondary)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              <span>Track Consignment</span>
            </Link>

            <Link
              href="/account/warranty"
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 8px",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                color: "var(--text-secondary)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>My Warranties & RMA</span>
            </Link>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 8px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: "none",
                  color: "var(--color-status-danger)",
                  fontSize: "var(--font-size-sm)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Sign Out ({customer?.phone})</span>
              </button>
            ) : (
              <Link
                href="/auth/login"
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 8px",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  color: "var(--color-brand-primary)",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: "600",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Customer Sign In / OTP</span>
              </Link>
            )}
          </div>
        </div>

        {/* Drawer Bottom Actions: WhatsApp Hotline & Showroom */}
        <div
          style={{
            padding: "var(--space-md)",
            borderTop: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-surface-elevated)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-sm)",
          }}
        >
          {/* WhatsApp Support Direct Button */}
          <a
            href="https://wa.me/8801700000000"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "#25D366",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: "700",
              fontSize: "var(--font-size-sm)",
              boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)",
            }}
          >
            <span>💬</span>
            <span>Nawabpur WhatsApp Support</span>
          </a>

          {/* Showroom Physical Address */}
          <div style={{ textAlign: "center", fontSize: "10px", color: "var(--text-tertiary)", lineHeight: "1.4" }}>
            Shop 42, Nawabpur Complex, Sundarban Square, Dhaka
          </div>
        </div>
      </div>
    </div>
  );
}
