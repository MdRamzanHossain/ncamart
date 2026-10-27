"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatPaisaToBDT, type CustomerProfile } from "./types";

interface AccountSidebarProps {
  profile: CustomerProfile;
  walletBalancePaisa: number;
  activeOrdersCount?: number;
  activeWarrantiesCount?: number;
}

export function AccountSidebar({
  profile,
  walletBalancePaisa,
  activeOrdersCount = 2,
  activeWarrantiesCount = 1,
}: AccountSidebarProps) {
  const pathname = usePathname();

  const navLinks = [
    {
      href: "/account",
      label: "Dashboard",
      icon: "📊",
      badge: null,
    },
    {
      href: "/account/orders",
      label: "Orders & Delivery",
      icon: "📦",
      badge: activeOrdersCount > 0 ? `${activeOrdersCount} Active` : null,
      badgeType: "accent",
    },
    {
      href: "/account/pre-orders",
      label: "Pre-Orders & Arrivals",
      icon: "⏳",
      badge: null,
    },
    {
      href: "/account/warranty",
      label: "Warranties & Claims",
      icon: "🛡️",
      badge: activeWarrantiesCount > 0 ? `${activeWarrantiesCount} Active` : null,
      badgeType: "success",
    },
    {
      href: "/account/wallet",
      label: "Store Credit Wallet",
      icon: "💳",
      badge: formatPaisaToBDT(walletBalancePaisa),
      badgeType: "wallet",
    },
    {
      href: "/account/wishlist",
      label: "Wishlist & Alerts",
      icon: "❤️",
      badge: null,
    },
    {
      href: "/account/addresses",
      label: "Address Book",
      icon: "📍",
      badge: null,
    },
    {
      href: "/account/profile",
      label: "Profile & Security",
      icon: "👤",
      badge: null,
    },
  ];

  return (
    <aside className="account-sidebar" aria-label="Account navigation">
      {/* Customer Quick Profile Card */}
      <div className="profile-card">
        <div className="avatar-wrap">
          <div className="avatar-circle">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          {profile.isPhoneVerified && (
            <span className="verified-badge" title="Verified Bangladesh Mobile">
              ✓
            </span>
          )}
        </div>

        <div className="profile-info">
          <h2 className="customer-name">{profile.name}</h2>
          <span className="customer-phone">{profile.phone}</span>
          <div className="tier-pill">
            {profile.tier === "PRO_ENGINEER"
              ? "⚡ Pro Engineer Tier"
              : profile.tier === "CORPORATE"
              ? "🏢 Corporate B2B Account"
              : "⭐ Nawabpur Valued Member"}
          </div>
        </div>

        {/* Quick Wallet Balance Pill */}
        <Link href="/account/wallet" className="quick-wallet-pill">
          <div className="wallet-label">
            <span className="wallet-icon">💳</span>
            <span>Store Credit Balance</span>
          </div>
          <span className="wallet-value" data-testid="sidebar-wallet-balance">
            {formatPaisaToBDT(walletBalancePaisa)}
          </span>
        </Link>
      </div>

      {/* Nav List */}
      <nav className="sidebar-nav">
        {navLinks.map((item) => {
          const isActive =
            item.href === "/account"
              ? pathname === "/account"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              {item.badge && (
                <span className={`nav-badge badge-${item.badgeType || "default"}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <button
          type="button"
          className="nav-item logout-btn"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.href = "/api/v1/auth/logout";
            }
          }}
        >
          <span className="nav-icon" aria-hidden="true">
            🚪
          </span>
          <span className="nav-label">Sign Out</span>
        </button>
      </nav>

      <style jsx>{`
        .account-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        .profile-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        .avatar-wrap {
          position: relative;
          margin-bottom: 0.75rem;
        }

        .avatar-circle {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: #ffffff;
          font-size: 1.5rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(5, 150, 105, 0.3);
        }

        .verified-badge {
          position: absolute;
          bottom: 0;
          right: -2px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #10b981;
          color: #ffffff;
          font-size: 0.6875rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #ffffff;
        }

        .customer-name {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.15rem;
        }

        .customer-phone {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-family: var(--font-mono, monospace);
          display: block;
          margin-bottom: 0.5rem;
        }

        .tier-pill {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.2rem 0.625rem;
          border-radius: 9999px;
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
          margin-bottom: 1rem;
        }

        .quick-wallet-pill {
          width: 100%;
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-lg, 0.75rem);
          padding: 0.75rem 1rem;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          transition: all 0.2s ease;
        }

        .quick-wallet-pill:hover {
          border-color: #059669;
          background: rgba(16, 185, 129, 0.05);
        }

        .wallet-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .wallet-value {
          font-family: var(--font-mono, monospace);
          font-size: 1.25rem;
          font-weight: 800;
          color: #059669;
        }

        .sidebar-nav {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md, 0.5rem);
          text-decoration: none;
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          font-weight: 600;
          transition: all 0.15s ease;
          border: none;
          background: transparent;
          width: 100%;
          cursor: pointer;
          text-align: left;
        }

        .nav-item:hover {
          background: var(--color-surface-subtle, #f8fafc);
          color: var(--color-text-primary);
        }

        .nav-item.active {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
          font-weight: 700;
        }

        .nav-icon {
          font-size: 1.125rem;
          flex-shrink: 0;
        }

        .nav-label {
          flex: 1;
        }

        .nav-badge {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }

        .badge-accent {
          background: #eff6ff;
          color: #2563eb;
        }

        .badge-success {
          background: #dcfce7;
          color: #16a34a;
        }

        .badge-wallet {
          background: #f0fdf4;
          color: #15803d;
          font-family: var(--font-mono, monospace);
        }

        .logout-btn {
          margin-top: 0.5rem;
          border-top: 1px dashed var(--color-border, #e5e7eb);
          padding-top: 0.75rem;
          color: #dc2626;
        }

        .logout-btn:hover {
          background: #fee2e2;
          color: #b91c1c;
        }
      `}</style>
    </aside>
  );
}
