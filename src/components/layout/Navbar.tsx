"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MegaMenu } from "./MegaMenu";
import { NotificationDrawer } from "./NotificationDrawer";
import { useAuth } from "@/context/AuthContext";
import { AuthenticBadge, BudgetSmartBadge } from "@/components/ui/badge";

export function Navbar({
  onSearchClick,
  onMobileMenuClick,
  onCartClick,
}: {
  onSearchClick?: () => void;
  onMobileMenuClick?: () => void;
  onCartClick?: () => void;
}) {
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

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="navbar-root"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 800,
          backgroundColor: isScrolled ? "var(--glass-bg)" : "var(--bg-surface)",
          backdropFilter: isScrolled ? "var(--glass-blur-md)" : "none",
          WebkitBackdropFilter: isScrolled ? "var(--glass-blur-md)" : "none",
          borderBottom: "1px solid var(--border-default)",
          boxShadow: isScrolled ? "var(--shadow-md)" : "none",
          transition: "all var(--duration-fast) var(--ease-in-out-smooth)",
          padding: isScrolled ? "var(--space-xs) var(--space-xl)" : "var(--space-sm) var(--space-xl)",
        }}
      >
        <div
          className="navbar-container"
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-md)",
          }}
        >
          {/* Left Brand & MegaMenu */}
          <div className="navbar-left-group" style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={onMobileMenuClick}
              aria-label="Open mobile menu"
              style={{
                display: "none",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
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

            {/* Logo with Holographic Foil Hover */}
            <Link
              href="/"
              aria-label="NCAMart Homepage"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                textDecoration: "none",
              }}
            >

              <div
                className="navbar-logo-box"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "var(--radius-md)",
                  background: "linear-gradient(135deg, #0b0f19 0%, #1e293b 50%, #0d9488 100%)",
                  border: "1.5px solid var(--tier-authentic-gold)",
                  boxShadow: "0 0 12px rgba(245, 158, 11, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontWeight: "900",
                  fontSize: "18px",
                  fontFamily: "var(--font-family-display)",
                  letterSpacing: "-0.05em",
                }}
              >
                N
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span
                    className="navbar-brand-title"
                    style={{
                      fontFamily: "var(--font-family-display)",
                      fontWeight: "800",
                      fontSize: "20px",
                      letterSpacing: "-0.03em",
                      color: "var(--text-primary)",
                    }}
                  >
                    NCA<span style={{ color: "var(--color-brand-primary)" }}>MART</span>
                  </span>
                  <span
                    className="navbar-nawabpur-badge"
                    style={{
                      fontSize: "9px",
                      textTransform: "uppercase",
                      backgroundColor: "var(--tier-authentic-gold-bg)",
                      color: "var(--tier-authentic-gold)",
                      padding: "1px 4px",
                      borderRadius: "var(--radius-xs)",
                      fontWeight: "700",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Nawabpur
                  </span>
                </div>
                <span
                  className="navbar-brand-subtitle"
                  style={{
                    fontSize: "10px",
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.02em",
                  }}
                >
                  Direct Importer Wholesale Hub
                </span>
              </div>
            </Link>

            {/* Mega Menu Dropdown */}
            <div className="navbar-megamenu-wrap">
              <MegaMenu />
            </div>
          </div>

          {/* Center Category Links */}
          <div
            className="navbar-center-links"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-lg)",
            }}
          >
            <Link
              href="/catalog?tier=AUTHENTIC"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-xs)",
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-medium)",
                color: "var(--text-secondary)",
                transition: "color var(--duration-fast) ease",
              }}
              className="interactive-scale"
            >
              <span>100% Authentic</span>
              <AuthenticBadge size="sm" pulse={false} />
            </Link>

            <Link
              href="/catalog?tier=BUDGET_SMART"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-xs)",
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-medium)",
                color: "var(--text-secondary)",
                transition: "color var(--duration-fast) ease",
              }}
              className="interactive-scale"
            >
              <span>Budget Smart</span>
              <BudgetSmartBadge size="sm" pulse={false} />
            </Link>

            <Link
              href="/pre-orders"
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-medium)",
                color: "var(--text-secondary)",
                transition: "color var(--duration-fast) ease",
              }}
              className="interactive-scale"
            >
              Pre-Order Showcase
            </Link>

            <Link
              href="/verify"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-bold)",
                color: "var(--tier-authentic-gold)",
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--tier-authentic-gold-bg)",
                border: "1px solid var(--tier-authentic-gold-border)",
              }}
              className="interactive-scale"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Verify Seal (/verify)</span>
            </Link>
          </div>

          {/* Right Action Icons: Search, Notifications, Cart, Account */}
          <div className="navbar-right-group" style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            {/* Search Quick Button */}
            <button
              type="button"
              onClick={onSearchClick}
              aria-label="Search catalog (Ctrl+K or Cmd+K)"
              className="navbar-search-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-full)",
                padding: "6px 14px",
                color: "var(--text-tertiary)",
                fontSize: "var(--font-size-xs)",
                cursor: "pointer",
                transition: "all var(--duration-fast) ease",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="navbar-search-label">Search products...</span>
              <kbd
                className="navbar-search-kbd"
                style={{
                  backgroundColor: "var(--bg-surface-active)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xs)",
                  padding: "1px 5px",
                  fontSize: "10px",
                  fontFamily: "var(--font-family-mono)",
                }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Notification Bell with Realtime Counter */}
            <button
              type="button"
              onClick={() => setIsNotificationOpen(true)}
              aria-label={`Notifications (${unreadCount} unread)`}
              style={{
                position: "relative",
                width: "38px",
                height: "38px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all var(--duration-fast) ease",
              }}
              className="interactive-scale"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-2px",
                    right: "-2px",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-destructive)",
                    color: "#ffffff",
                    fontSize: "10px",
                    fontWeight: "var(--font-weight-bold)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid var(--bg-surface)",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Wishlist Button */}
            <Link
              href="/account/wishlist"
              aria-label={`Wishlist (${wishlistCount} items)`}
              style={{
                position: "relative",
                width: "38px",
                height: "38px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all var(--duration-fast) ease",
              }}
              className="interactive-scale navbar-wishlist-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </Link>

            {/* Cart Button with Counter */}
            <button
              type="button"
              onClick={onCartClick}
              aria-label={`Shopping cart with ${cartCount} items`}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-xs)",
                height: "38px",
                padding: "0 var(--space-md)",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--color-brand-primary)",
                color: "#ffffff",
                fontWeight: "var(--font-weight-semibold)",
                fontSize: "var(--font-size-xs)",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 10px var(--color-brand-primary-glow)",
              }}
              className="interactive-scale navbar-cart-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              <span className="navbar-cart-label">Cart</span>
              <span
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.25)",
                  padding: "1px 6px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "11px",
                  fontWeight: "var(--font-weight-bold)",
                }}
              >
                {cartCount}
              </span>
            </button>

            {/* User Account / Login */}
            {isAuthenticated ? (
              <Link
                href={user?.isStaff ? "/admin" : "/account"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2xs)",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-default)",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--text-primary)",
                }}
                className="interactive-scale"
              >
                <div
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    backgroundColor: user?.isStaff ? "var(--color-destructive)" : "var(--color-brand-primary)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {(user?.name || user?.phone || "U").charAt(0).toUpperCase()}
                </div>
                <span className="navbar-account-label">{user?.isStaff ? "Backoffice" : "Account"}</span>
              </Link>
            ) : (
              <Link
                href="/auth/login"
                style={{
                  fontSize: "var(--font-size-xs)",
                  fontWeight: "var(--font-weight-medium)",
                  color: "var(--text-primary)",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                }}
                className="interactive-scale navbar-login-btn"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Slide-Over Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onUnreadCountChange={(c) => setUnreadCount(c)}
      />
    </>
  );
}

