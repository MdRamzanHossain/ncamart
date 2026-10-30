"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MegaMenu } from "./MegaMenu";
import { NotificationDrawer } from "./NotificationDrawer";
import { useAuth } from "@/context/AuthContext";

export function Navbar({
  onSearchClick,
  onMobileMenuClick,
  onCartClick,
}: {
  onSearchClick?: () => void;
  onMobileMenuClick?: () => void;
  onCartClick?: () => void;
}) {
  const pathname = usePathname();
  const { user, isAuthenticated, cartCount } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);
  const [wishlistCount] = useState(0);

  // Compress navbar on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Home", href: "/", active: pathname === "/" },
    { label: "Collections", href: "/catalog", active: pathname === "/catalog" },
    { label: "Deals", href: "/catalog?campaign=clearance", active: false },
    { label: "100% Authentic", href: "/catalog?tier=AUTHENTIC", active: false },
    { label: "Budget Smart", href: "/catalog?tier=BUDGET_SMART", active: false },
    { label: "Pre-Orders", href: "/pre-orders", active: pathname?.startsWith("/pre-order") },
    { label: "Verify Seal", href: "/verify", active: pathname?.startsWith("/verify") },
  ];

  return (
    <>
      <header
        aria-label="Main navigation"
        className="navbar-root"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 800,
          backgroundColor: "#0b0e23",
          color: "#ffffff",
          boxShadow: isScrolled ? "0 10px 30px rgba(5, 8, 22, 0.45)" : "none",
          transition: "all var(--duration-fast) var(--ease-in-out-smooth)",
        }}
      >
        {/* Row 1: Brand Logo + Centered Pill Search Bar + Action Icons */}
        <div
          className="navbar-container"
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: isScrolled ? "10px 24px" : "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
          }}
        >
          {/* Left: Hamburger + NEXORA/NCAMART Brand Logo */}
          <div className="navbar-left-group" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={onMobileMenuClick}
              aria-label="Open mobile menu"
              style={{
                display: "none",
                background: "transparent",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                padding: "6px",
              }}
              className="mobile-hamburger-btn"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <Link
              href="/"
              aria-label="NCAMart Homepage"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textDecoration: "none",
              }}
            >
              {/* Colorful X/N Ribbon Icon matching reference design */}
              <div
                className="navbar-logo-box"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #ff5e62 0%, #a855f7 50%, #38bdf8 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontWeight: "900",
                  fontSize: "18px",
                  fontFamily: "var(--font-family-display)",
                  boxShadow: "0 4px 14px rgba(255, 94, 98, 0.35)",
                }}
              >
                N
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  className="navbar-brand-title"
                  style={{
                    fontFamily: "var(--font-family-display)",
                    fontWeight: "800",
                    fontSize: "21px",
                    letterSpacing: "0.08em",
                    color: "#ffffff",
                  }}
                >
                  NCAMART
                </span>
                <span
                  className="navbar-nawabpur-badge"
                  style={{
                    fontSize: "9px",
                    textTransform: "uppercase",
                    backgroundColor: "rgba(245, 158, 11, 0.18)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    color: "#fbbf24",
                    padding: "2px 5px",
                    borderRadius: "4px",
                    fontWeight: "700",
                    letterSpacing: "0.05em",
                  }}
                >
                  Nawabpur
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Wide Pill Search Bar (matching reference header) */}
          <div
            className="navbar-search-center"
            style={{
              flex: 1,
              maxWidth: "560px",
              display: "flex",
               justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={onSearchClick}
              aria-label="Search catalog (Ctrl+K or Cmd+K)"
              className="navbar-search-btn"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                borderRadius: "9999px",
                padding: "9px 18px",
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all var(--duration-fast) ease",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="navbar-search-label">Search for products, brands &amp; more...</span>
              </span>
              <kbd
                className="navbar-search-kbd"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  borderRadius: "6px",
                  padding: "2px 6px",
                  fontSize: "10px",
                  color: "rgba(255, 255, 255, 0.85)",
                  fontFamily: "var(--font-family-mono)",
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right: Clean Icon Cluster (Account, Wishlist, Notifications, Cart Badge) */}
          <div className="navbar-right-group" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* User Account / Login Icon */}
            <Link
              href={isAuthenticated ? (user?.isStaff ? "/admin" : "/account") : "/auth/login"}
              aria-label={isAuthenticated ? (user?.isStaff ? "Backoffice" : "Account") : "Login"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "600",
                padding: "6px",
                borderRadius: "9999px",
              }}
              className="interactive-scale"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {isAuthenticated && (
                <span className="navbar-account-label" style={{ color: "#fbbf24", fontSize: "11px" }}>
                  {(user?.name || user?.phone || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </Link>

            {/* Wishlist Heart Icon */}
            <Link
              href="/account/wishlist"
              aria-label={`Wishlist (${wishlistCount} items)`}
              style={{
                position: "relative",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px",
                cursor: "pointer",
              }}
              className="interactive-scale navbar-wishlist-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </Link>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsNotificationOpen(true)}
              aria-label={`Notifications (${unreadCount} unread)`}
              style={{
                position: "relative",
                color: "#ffffff",
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px",
                cursor: "pointer",
              }}
              className="interactive-scale"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "0px",
                    right: "0px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    backgroundColor: "#ff5e62",
                    color: "#ffffff",
                    fontSize: "9px",
                    fontWeight: "800",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Shopping Cart Icon with Coral Badge (matching reference) */}
            <button
              type="button"
              onClick={onCartClick}
              aria-label={`Shopping cart with ${cartCount} items`}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px",
                background: "transparent",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
              className="interactive-scale navbar-cart-btn"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              <span
                style={{
                  position: "absolute",
                  top: "-2px",
                  right: "-4px",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 4px",
                  borderRadius: "9999px",
                  backgroundColor: "#ff5e62",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: "800",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(255, 94, 98, 0.5)",
                }}
              >
                {cartCount}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Navigation Bar (Home, Categories, Collections, Deals, Creators/Pre-Orders, Verify Seal) */}
        <div
          className="navbar-center-links"
          style={{
            backgroundColor: "#121738",
            borderTop: "1px solid rgba(255, 255, 255, 0.07)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div
            style={{
              maxWidth: "1400px",
              margin: "0 auto",
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              gap: "28px",
              height: "42px",
            }}
          >
            {navLinks.slice(0, 1).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  position: "relative",
                  height: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "13px",
                  fontWeight: item.active ? "700" : "500",
                  color: item.active ? "#ffffff" : "rgba(255, 255, 255, 0.78)",
                  textDecoration: "none",
                  borderBottom: item.active ? "2.5px solid #ff5e62" : "2.5px solid transparent",
                }}
              >
                {item.label}
              </Link>
            ))}

            {/* MegaMenu Dropdown Trigger */}
            <div className="navbar-megamenu-wrap" style={{ display: "flex", alignItems: "center" }}>
              <MegaMenu />
            </div>

            {navLinks.slice(1).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  position: "relative",
                  height: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "13px",
                  fontWeight: item.active || item.label === "Verify Seal" ? "700" : "500",
                  color:
                    item.label === "Verify Seal"
                      ? "#fbbf24"
                      : item.active
                        ? "#ffffff"
                        : "rgba(255, 255, 255, 0.78)",
                  textDecoration: "none",
                  borderBottom: item.active ? "2.5px solid #ff5e62" : "2.5px solid transparent",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Slide-Over Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onUnreadCountChange={(c) => setUnreadCount(c)}
      />
    </>
  );
}


