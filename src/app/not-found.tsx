"use client";

import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-root" id="main-content">
      {/* Ambient glowing orbs */}
      <div className="ambient-glow glow-cyan" />
      <div className="ambient-glow glow-gold" />
      <div className="grid-overlay" />

      <div className="not-found-card">
        {/* Holographic 404 Number Badge */}
        <div className="status-emblem">
          <div className="circuit-orbit ring-1" />
          <div className="circuit-orbit ring-2" />
          <div className="error-number">404</div>
        </div>

        {/* Badge Row */}
        <div className="badge-row">
          <span className="badge-pill">
            <span className="dot-radar" />
            LOST IN NAWABPUR
          </span>
          <span className="badge-sub">Road #4 Unmapped Lane</span>
        </div>

        <h1 className="error-title">
          Resource or Lane Not Found
          <span className="title-bn">নির্দিষ্ট পৃষ্ঠা বা পণ্যটি পাওয়া যায়নি</span>
        </h1>

        <p className="error-description">
          The accessory, stall, or URL you are navigating to does not exist, has been relocated, or is undergoing
          Nawabpur godown inventory restocking.
        </p>

        {/* Quick Action Buttons */}
        <div className="action-buttons">
          <Link href="/" className="btn btn-primary" id="btn-404-home">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Back to Storefront (হোমপেজে ফিরুন)</span>
          </Link>

          <Link href="/products" className="btn btn-secondary" id="btn-404-catalog">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span>Browse All Accessories (ক্যাটালগ)</span>
          </Link>
        </div>

        {/* Popular Shortcuts */}
        <div className="shortcuts-box">
          <span className="shortcuts-label">Popular Destinations</span>
          <div className="chip-row">
            <Link href="/verify" className="shortcut-chip">
              <span>🛡️ Verify Seal</span>
            </Link>
            <Link href="/pre-orders" className="shortcut-chip">
              <span>✈️ Pre-Orders</span>
            </Link>
            <Link href="/compare" className="shortcut-chip">
              <span>⚖️ Compare Specs</span>
            </Link>
            <Link href="/account/orders" className="shortcut-chip">
              <span>📦 Track Orders</span>
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .not-found-root {
          min-height: calc(100vh - 80px);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 40px 16px 80px 16px;
          background-color: var(--bg-base, #0b0f19);
          overflow: hidden;
          font-family: var(--font-body, inherit);
        }

        .ambient-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(130px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.16;
        }

        .glow-cyan {
          width: 500px;
          height: 500px;
          background: #0ea5e9;
          top: 15%;
          left: 10%;
          animation: orbFloat 16s ease-in-out infinite alternate;
        }

        .glow-gold {
          width: 480px;
          height: 480px;
          background: #f59e0b;
          bottom: 12%;
          right: 12%;
          animation: orbFloat 14s ease-in-out infinite alternate-reverse;
        }

        @keyframes orbFloat {
          0% {
            transform: translate(0, 0) scale(1);
          }
          100% {
            transform: translate(35px, 25px) scale(1.12);
          }
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
          z-index: 1;
        }

        .not-found-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 660px;
          background: var(--bg-surface, #111827);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: var(--radius-2xl, 24px);
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7),
                      0 0 35px -5px rgba(59, 130, 246, 0.12);
          padding: 48px 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          backdrop-filter: blur(16px);
        }

        .status-emblem {
          position: relative;
          width: 130px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        .circuit-orbit {
          position: absolute;
          border-radius: 50%;
          border: 1px dashed rgba(56, 189, 248, 0.35);
          animation: spin 20s linear infinite;
        }

        .ring-1 {
          width: 110px;
          height: 110px;
        }

        .ring-2 {
          width: 130px;
          height: 130px;
          border-style: dotted;
          animation-direction: reverse;
          animation-duration: 25s;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .error-number {
          font-family: var(--font-heading, monospace);
          font-size: 64px;
          font-weight: 900;
          letter-spacing: -0.05em;
          background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 50%, #f59e0b 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 6px 16px rgba(56, 189, 248, 0.3));
        }

        .badge-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: rgba(14, 165, 233, 0.12);
          border: 1px solid rgba(14, 165, 233, 0.35);
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #7dd3fc;
          text-transform: uppercase;
        }

        .dot-radar {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #0ea5e9;
          box-shadow: 0 0 8px #0ea5e9;
        }

        .badge-sub {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-tertiary, #94a3b8);
        }

        .error-title {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary, #f9fafb);
          line-height: 1.25;
          margin: 0 0 8px 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .title-bn {
          font-size: 17px;
          font-weight: 600;
          color: #38bdf8;
          font-family: inherit;
        }

        .error-description {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-secondary, #9ca3af);
          margin: 8px 0 28px 0;
          max-width: 500px;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          flex-wrap: wrap;
          width: 100%;
          margin-bottom: 28px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 22px;
          border-radius: var(--radius-lg, 12px);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 18px rgba(59, 130, 246, 0.35);
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 22px rgba(59, 130, 246, 0.45);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary, #f9fafb);
          border: 1px solid var(--border-glow, rgba(255, 255, 255, 0.14));
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.09);
          transform: translateY(-1.5px);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .shortcuts-box {
          width: 100%;
          padding: 16px 20px;
          border-radius: var(--radius-md, 12px);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: center;
        }

        .shortcuts-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-tertiary, #94a3b8);
        }

        .chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .shortcut-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #cbd5e1);
          text-decoration: none;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .shortcut-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        @media (max-width: 640px) {
          .not-found-card {
            padding: 36px 20px;
          }

          .error-number {
            font-size: 52px;
          }

          .error-title {
            font-size: 22px;
          }

          .title-bn {
            font-size: 15px;
          }

          .action-buttons {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
