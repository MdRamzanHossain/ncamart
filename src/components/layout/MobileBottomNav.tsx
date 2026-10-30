"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface MobileBottomNavProps {
  onOpenCategories?: () => void;
  onCartClick?: () => void;
}

export function MobileBottomNav({ onOpenCategories, onCartClick }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { cartCount } = useAuth();

  const isHome = pathname === "/";
  const isVerify = pathname.startsWith("/verify");
  const isWishlist =
    pathname.startsWith("/account/wishlist") ||
    pathname.startsWith("/customer/wishlist") ||
    pathname === "/wishlist";
  const isCart = pathname.startsWith("/cart");

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 850,
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid #e2e8f0",
        boxShadow: "0 -4px 20px rgba(15, 23, 42, 0.08)",
        paddingBottom: "max(env(safe-area-inset-bottom, 8px), 8px)",
        paddingTop: "6px",
      }}
      className="mobile-only-dock"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          maxWidth: "600px",
          margin: "0 auto",
          paddingLeft: "4px",
          paddingRight: "4px",
        }}
      >
        {/* 1. Home Tab */}
        <Link
          href="/"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            textDecoration: "none",
            color: isHome ? "#2563eb" : "#64748b",
            transition: "all 0.15s ease",
            padding: "4px 10px",
            borderRadius: "10px",
            minWidth: "56px",
          }}
          className="interactive-scale"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isHome ? "2.5" : "2"}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span style={{ fontSize: "10px", fontWeight: isHome ? "700" : "600" }}>Home</span>
        </Link>

        {/* 2. Categories Tab */}
        <button
          type="button"
          onClick={onOpenCategories}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: "4px 10px",
            borderRadius: "10px",
            minWidth: "56px",
          }}
          className="interactive-scale"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span style={{ fontSize: "10px", fontWeight: "600" }}>Catalog</span>
        </button>

        {/* 3. Center Highlight: Verify Seal (/verify) */}
        <Link
          href="/verify"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textDecoration: "none",
            position: "relative",
            top: "-12px",
            minWidth: "64px",
          }}
          className="interactive-scale"
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              boxShadow: "0 6px 16px rgba(217, 119, 6, 0.35)",
              border: "3px solid #ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "10px",
              fontWeight: "700",
              color: isVerify ? "#d97706" : "#334155",
              marginTop: "2px",
            }}
          >
            Verify
          </span>
        </Link>

        {/* 4. Wishlist Tab */}
        <Link
          href="/account/wishlist"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            textDecoration: "none",
            color: isWishlist ? "#2563eb" : "#64748b",
            transition: "all 0.15s ease",
            padding: "4px 10px",
            borderRadius: "10px",
            minWidth: "56px",
          }}
          className="interactive-scale"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isWishlist ? "2.5" : "2"}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span style={{ fontSize: "10px", fontWeight: isWishlist ? "700" : "600" }}>Wishlist</span>
        </Link>

        {/* 5. Cart Tab with Live Counter */}
        <button
          type="button"
          onClick={onCartClick}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isCart ? "#2563eb" : "#64748b",
            transition: "all 0.15s ease",
            padding: "4px 10px",
            borderRadius: "10px",
            minWidth: "56px",
            position: "relative",
          }}
          className="interactive-scale"
        >
          <div style={{ position: "relative" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isCart ? "2.5" : "2"}>
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {cartCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-10px",
                  backgroundColor: "#ff5e62",
                  color: "#ffffff",
                  fontSize: "9px",
                  fontWeight: "800",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </div>
          <span style={{ fontSize: "10px", fontWeight: isCart ? "700" : "600" }}>Cart</span>
        </button>
      </div>

      <style jsx global>{`
        @media (min-width: 769px) {
          .mobile-only-dock {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
}
