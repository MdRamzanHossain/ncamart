"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";
import { CrockfordInputMask } from "./CrockfordInputMask";
import { QrScannerModal } from "./QrScannerModal";
import { SealLocationGuide } from "./SealLocationGuide";

export function VerifyPortalView() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  return (
    <StorefrontShell>
      <div className="verify-portal-root">
        {/* Breadcrumb Navigation */}
        <div className="breadcrumb-wrapper">
          <div className="breadcrumb-inner">
            <Link href="/" className="crumb-link">Home</Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">Holographic Seal & Serial Verification</span>
          </div>
        </div>

        {/* Hero Section */}
        <section className="verify-hero-section">
          <div className="hero-glow-layer" />

          <div className="hero-content">
            <div className="badge-row">
              <span className="pill-verify">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Public Anti-Counterfeit Portal
              </span>
              <span className="pill-engine">
                Crockford Base32 Cryptographic Engine
              </span>
            </div>

            <h1 className="hero-headline">
              NCAMart Holographic Seal & <br />
              <span className="gradient-text">Serial Verification Engine</span>
            </h1>

            <p className="hero-description">
              Verify the authenticity, distributor supply chain, and godown packaging video of your tech accessory.
              Every parcel shipped from Nawabpur carries a physical destructive VOID seal and a cryptographically randomized 8-character ID.
            </p>

            {/* Input Mask & Scanner Trigger Card */}
            <div className="search-card-wrapper">
              <div className="input-search-box">
                <label className="input-label" htmlFor="seal-id-input">
                  Enter 8-Character Seal ID:
                </label>
                <CrockfordInputMask />
              </div>

              <div className="or-divider">
                <span className="line" />
                <span className="or-text">OR</span>
                <span className="line" />
              </div>

              {/* One-Tap QR Scanner Button */}
              <button
                type="button"
                className="btn-qr-scan"
                onClick={() => setIsScannerOpen(true)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>Scan QR Code on Holographic Seal</span>
              </button>

              {/* Sample IDs for instant testing */}
              <div className="quick-samples">
                <span className="samples-lbl">Quick Demo Seals:</span>
                <Link href="/verify/NCA-9X4K-2M7B" className="sample-link valid-link">
                  ✓ Genuine: NCA-9X4K-2M7B
                </Link>
                <Link href="/verify/NCA-VOID-7721" className="sample-link void-link">
                  ⚠ Voided: NCA-VOID-7721
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive 3D Demonstration Section */}
        <section className="guide-section">
          <div className="guide-inner">
            <SealLocationGuide />
          </div>
        </section>

        {/* 4 Trust Verification Pillars */}
        <section className="pillars-section">
          <div className="pillars-grid">
            <div className="pillar-item">
              <div className="pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h4 className="pillar-title">Destructive Substrate</h4>
              <p className="pillar-desc">
                Physical VOID pattern permanently transfers to package if removal is attempted.
              </p>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <h4 className="pillar-title">Godown QC Video Proof</h4>
              <p className="pillar-desc">
                10-second inspection and packaging snippet recorded at Nawabpur central godown.
              </p>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h4 className="pillar-title">CGNAT-Safe Clone Safeguard</h4>
              <p className="pillar-desc">
                Internal rate limiting and clone telemetry log repeat lookups across diverse subnets.
              </p>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                  <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
                  <line x1="16" y1="8" x2="2" y2="22" />
                  <line x1="17.5" y1="15" x2="9" y2="15" />
                </svg>
              </div>
              <h4 className="pillar-title">Live Warranty Tracker</h4>
              <p className="pillar-desc">
                Days remaining in authorized distributor warranty linked to verified physical seal.
              </p>
            </div>
          </div>
        </section>

        {/* QR Scanner Modal */}
        <QrScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
        />
      </div>

      <style jsx>{`
        .verify-portal-root {
          min-height: 100vh;
          background: var(--color-bg-canvas, #090d16);
          color: var(--color-text-primary, #f9fafb);
        }

        .breadcrumb-wrapper {
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(15, 23, 42, 0.5);
          padding: 0.75rem 1.5rem;
        }

        .breadcrumb-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
        }

        .crumb-link {
          color: #9ca3af;
          text-decoration: none;
        }

        .crumb-link:hover {
          color: #60a5fa;
        }

        .crumb-sep {
          color: #4b5563;
        }

        .crumb-current {
          color: #e5e7eb;
          font-weight: 600;
        }

        .verify-hero-section {
          position: relative;
          padding: 3.5rem 1.5rem 3rem;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(9, 13, 22, 0.98) 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
          text-align: center;
        }

        .hero-glow-layer {
          position: absolute;
          top: -120px;
          left: 50%;
          transform: translateX(-50%);
          width: 650px;
          height: 320px;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(59, 130, 246, 0.12) 50%, transparent 80%);
          filter: blur(60px);
          pointer-events: none;
        }

        .hero-content {
          position: relative;
          max-width: 820px;
          margin: 0 auto;
          z-index: 1;
        }

        .badge-row {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          margin-bottom: 1.25rem;
        }

        .pill-verify {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #6ee7b7;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
        }

        .pill-engine {
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #93c5fd;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
        }

        .hero-headline {
          font-size: clamp(1.85rem, 4vw, 2.75rem);
          font-weight: 800;
          line-height: 1.25;
          color: #f9fafb;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }

        .gradient-text {
          background: linear-gradient(135deg, #34d399 0%, #60a5fa 50%, #a78bfa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-description {
          font-size: 1rem;
          line-height: 1.6;
          color: #9ca3af;
          margin: 0 auto 2.5rem;
          max-width: 680px;
        }

        .search-card-wrapper {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 1.25rem;
          padding: 1.75rem;
          max-width: 620px;
          margin: 0 auto;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
          text-align: left;
        }

        .input-search-box {
          margin-bottom: 1.25rem;
        }

        .input-label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #d1d5db;
          margin-bottom: 0.5rem;
        }

        .or-divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin: 1.25rem 0;
        }

        .line {
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        .or-text {
          font-size: 0.725rem;
          font-weight: 700;
          color: #64748b;
        }

        .btn-qr-scan {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          width: 100%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f3f4f6;
          padding: 0.875rem 1.25rem;
          border-radius: 0.875rem;
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-qr-scan:hover {
          background: rgba(16, 185, 129, 0.12);
          border-color: rgba(16, 185, 129, 0.35);
          color: #6ee7b7;
        }

        .quick-samples {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1.25rem;
          padding-top: 1rem;
          border-top: 1px dashed rgba(255, 255, 255, 0.08);
          font-size: 0.75rem;
        }

        .samples-lbl {
          color: #9ca3af;
        }

        .sample-link {
          text-decoration: none;
          padding: 0.25rem 0.6rem;
          border-radius: 9999px;
          font-family: var(--font-mono, monospace);
          font-weight: 600;
          transition: all 0.15s ease;
        }

        .valid-link {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #6ee7b7;
        }

        .valid-link:hover {
          background: rgba(16, 185, 129, 0.25);
        }

        .void-link {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .void-link:hover {
          background: rgba(239, 68, 68, 0.25);
        }

        .guide-section {
          padding: 3rem 1.5rem;
        }

        .guide-inner {
          max-width: 1100px;
          margin: 0 auto;
        }

        .pillars-section {
          padding: 0 1.5rem 4rem;
        }

        .pillars-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
        }

        .pillar-item {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 1rem;
          padding: 1.25rem;
        }

        .pillar-icon {
          width: 38px;
          height: 38px;
          border-radius: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.875rem;
        }

        .pillar-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0 0 0.35rem;
        }

        .pillar-desc {
          font-size: 0.8125rem;
          color: #9ca3af;
          margin: 0;
          line-height: 1.45;
        }
      `}</style>
    </StorefrontShell>
  );
}
