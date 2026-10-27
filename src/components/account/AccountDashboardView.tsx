"use client";

import React from "react";
import Link from "next/link";
import { formatPaisaToBDT, type CustomerProfile } from "./types";

interface AccountDashboardViewProps {
  profile: CustomerProfile;
  walletBalancePaisa: number;
  activeOrdersCount: number;
  preOrdersCount: number;
  activeWarrantiesCount: number;
}

export function AccountDashboardView({
  profile,
  walletBalancePaisa,
  activeOrdersCount,
  preOrdersCount,
  activeWarrantiesCount,
}: AccountDashboardViewProps) {
  return (
    <div className="account-dashboard" role="region" aria-label="Customer Account Dashboard">
      {/* Welcome Banner */}
      <section className="welcome-banner">
        <div className="banner-left">
          <span className="greeting-sub">NAWABPUR COMPLEX ACCESSORIES PORTAL</span>
          <h1 className="greeting-title">
            Welcome back, {profile.name}
          </h1>
          <p className="greeting-desc">
            Track your high-tech orders, pre-order import milestones, and official distributor warranties in real time.
          </p>
        </div>
        <div className="banner-badge">
          <span className="member-status">
            {profile.tier === "PRO_ENGINEER"
              ? "⚡ PRO ENGINEER"
              : "⭐ VALUED MEMBER"}
          </span>
          <span className="member-since">Member since 2026</span>
        </div>
      </section>

      {/* 4 Key Metrics Cards */}
      <section className="stats-grid">
        <Link href="/account/orders" className="stat-card">
          <div className="stat-icon-wrap bg-blue">📦</div>
          <div className="stat-info">
            <span className="stat-label">ACTIVE ORDERS</span>
            <span className="stat-value" data-testid="metric-active-orders">
              {activeOrdersCount} In Transit
            </span>
            <span className="stat-hint">Track live rider & courier dispatch</span>
          </div>
        </Link>

        <Link href="/account/wallet" className="stat-card">
          <div className="stat-icon-wrap bg-emerald">💳</div>
          <div className="stat-info">
            <span className="stat-label">STORE CREDIT WALLET</span>
            <span className="stat-value text-emerald" data-testid="metric-wallet-balance">
              {formatPaisaToBDT(walletBalancePaisa)}
            </span>
            <span className="stat-hint">Instant 1-click checkout & withdrawal</span>
          </div>
        </Link>

        <Link href="/account/pre-orders" className="stat-card">
          <div className="stat-icon-wrap bg-amber">⏳</div>
          <div className="stat-info">
            <span className="stat-label">PRE-ORDER IMPORTS</span>
            <span className="stat-value" data-testid="metric-preorders">
              {preOrdersCount} Reserved
            </span>
            <span className="stat-hint">Direct air cargo arrival tracking</span>
          </div>
        </Link>

        <Link href="/account/warranty" className="stat-card">
          <div className="stat-icon-wrap bg-purple">🛡️</div>
          <div className="stat-info">
            <span className="stat-label">ACTIVE WARRANTIES</span>
            <span className="stat-value" data-testid="metric-warranties">
              {activeWarrantiesCount} Devices
            </span>
            <span className="stat-hint">72h Dhaka Doorstep RMA Swap</span>
          </div>
        </Link>
      </section>

      {/* Quick Action Dock */}
      <section className="quick-actions-panel">
        <h2>Quick Shortcuts</h2>
        <div className="actions-grid">
          <Link href="/verify" className="action-pill">
            <span className="pill-icon">🔍</span>
            <div className="pill-text">
              <strong>Verify Holographic Seal</strong>
              <span>Scan QR code or enter Crockford ID</span>
            </div>
          </Link>

          <Link href="/account/orders" className="action-pill">
            <span className="pill-icon">📍</span>
            <div className="pill-text">
              <strong>Live Delivery Tracker</strong>
              <span>Real-time courier progress updates</span>
            </div>
          </Link>

          <Link href="/account/wallet" className="action-pill">
            <span className="pill-icon">💸</span>
            <div className="pill-text">
              <strong>Withdraw Store Credit</strong>
              <span>Cash out to bKash or Bank Account</span>
            </div>
          </Link>

          <Link href="/products" className="action-pill">
            <span className="pill-icon">🛒</span>
            <div className="pill-text">
              <strong>Wholesale Catalog</strong>
              <span>Browse authentic engineering gear</span>
            </div>
          </Link>
        </div>
      </section>

      <style jsx>{`
        .account-dashboard {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .welcome-banner {
          background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 2.25rem;
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
          box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.4);
        }

        @media (max-width: 768px) {
          .welcome-banner {
            flex-direction: column;
            align-items: flex-start;
            padding: 1.5rem;
          }
        }

        .greeting-sub {
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          font-weight: 800;
          color: #a7f3d0;
          display: block;
          margin-bottom: 0.35rem;
        }

        .greeting-title {
          font-size: 1.75rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .greeting-desc {
          font-size: 0.875rem;
          color: #d1fae5;
          max-width: 480px;
          line-height: 1.4;
        }

        .banner-badge {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: var(--radius-lg, 0.75rem);
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          flex-shrink: 0;
        }

        .member-status {
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #fef08a;
        }

        .member-since {
          font-size: 0.6875rem;
          color: #d1fae5;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
        }

        .stat-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 1.25rem;
          display: flex;
          gap: 1rem;
          align-items: center;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          border-color: #059669;
          box-shadow: 0 8px 20px rgba(5, 150, 105, 0.1);
        }

        .stat-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-lg, 0.75rem);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .bg-blue { background: #eff6ff; }
        .bg-emerald { background: #ecfdf5; }
        .bg-amber { background: #fffbeb; }
        .bg-purple { background: #faf5ff; }

        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .stat-label {
          font-size: 0.6875rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          letter-spacing: 0.05em;
        }

        .stat-value {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .text-emerald {
          color: #059669;
          font-family: var(--font-mono, monospace);
        }

        .stat-hint {
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
        }

        .quick-actions-panel {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 1.75rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        .quick-actions-panel h2 {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 1.25rem;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }

        .action-pill {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-lg, 0.75rem);
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .action-pill:hover {
          border-color: #059669;
          background: #f0fdf4;
        }

        .pill-icon {
          font-size: 1.5rem;
        }

        .pill-text {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .pill-text strong {
          font-size: 0.875rem;
          color: var(--color-text-primary);
        }

        .pill-text span {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }
      `}</style>
    </div>
  );
}
