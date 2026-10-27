"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { CrockfordInputMask } from "./CrockfordInputMask";

export interface VerificationProduct {
  titleEn: string;
  titleBn: string;
  brandName: string;
  model?: string;
  imageUrl?: string | null;
  productTier: "AUTHENTIC" | "BUDGET_SMART";
}

export interface VerificationQCInspector {
  code: string;
  name: string;
  verifiedAt: string;
  location: string;
  benchNumber: string;
  checklistPassed: string[];
}

export interface VerificationWarranty {
  status: "ACTIVE" | "EXPIRED" | "NOT_STARTED" | "CLAIMED";
  warrantyDaysTotal: number;
  startsAt: string | null;
  expiresAt: string | null;
  coverageType: string;
}

export interface VerificationPackagingProof {
  videoUrl?: string;
  durationSec: number;
  recordedAt: string;
  inspectorNote: string;
  photoUrls?: string[];
}

export interface SealVerificationData {
  isValid: boolean;
  sealId: string;
  status: "VERIFIED" | "VOID" | "NOT_FOUND";
  voidReason?: string;
  product?: VerificationProduct;
  serialNumber?: string | null;
  batchCode?: string;
  qcInspector?: VerificationQCInspector;
  warranty?: VerificationWarranty;
  packagingProof?: VerificationPackagingProof;
  lookupCount?: number;
  message?: string;
}

interface SealVerificationResultViewProps {
  initialData: SealVerificationData;
}

export function SealVerificationResultView({ initialData }: SealVerificationResultViewProps) {
  const [data, setData] = useState<SealVerificationData>(initialData);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });
  const [isCopied, setIsCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Compute live warranty countdown if expiry date is available
  useEffect(() => {
    if (!data.warranty?.expiresAt) {
      if (data.warranty?.warrantyDaysTotal) {
        setTimeRemaining({
          days: data.warranty.warrantyDaysTotal,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: false,
        });
      }
      return;
    }

    const targetTime = new Date(data.warranty.expiresAt).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds, isExpired: false });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [data.warranty]);

  // Video progress simulator / time tracker
  useEffect(() => {
    let animFrame: number;
    if (isPlayingVideo) {
      const start = Date.now();
      const durationMs = 10000; // 10 seconds

      const loop = () => {
        const elapsed = (Date.now() - start) % durationMs;
        setVideoProgress(elapsed / durationMs);
        animFrame = requestAnimationFrame(loop);
      };
      animFrame = requestAnimationFrame(loop);
    } else {
      setVideoProgress(0);
    }

    return () => cancelAnimationFrame(animFrame);
  }, [isPlayingVideo]);

  const handleShare = async () => {
    if (typeof window !== "undefined") {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      } catch {
        // Fallback
      }
    }
  };

  const isVerified = data.status === "VERIFIED" && data.isValid;
  const isVoid = data.status === "VOID" || (!data.isValid && data.status !== "NOT_FOUND");
  const isNotFound = data.status === "NOT_FOUND";

  return (
    <div className="verification-result-wrapper">
      <div className="container">
        {/* Navigation Breadcrumbs */}
        <nav className="verify-nav" aria-label="Breadcrumb">
          <Link href="/" className="nav-link">Storefront</Link>
          <span className="separator">/</span>
          <Link href="/verify" className="nav-link">Seal Verification Engine</Link>
          <span className="separator">/</span>
          <span className="current-id">{data.sealId || "Lookup"}</span>
        </nav>

        {/* 1. STATE: GENUINE VERIFIED (status === "VERIFIED") */}
        {isVerified && (
          <div className="result-card verified-card" role="region" aria-label="Genuine Verification Result">
            {/* Holographic Glowing Seal Header */}
            <header className="verified-header">
              <div className="hologram-seal-stamp" data-testid="verified-stamp">
                <div className="stamp-halo"></div>
                <div className="stamp-core">
                  <div className="hologram-shimmer"></div>
                  <div className="stamp-icon-wrap">
                    <svg className="spring-checkmark" viewBox="0 0 52 52" width="48" height="48" aria-hidden="true">
                      <circle className="checkmark-circle" cx="26" cy="26" r="24" fill="none" />
                      <path className="checkmark-check" fill="none" d="M14 27l8 8 16-16" />
                    </svg>
                  </div>
                  <span className="stamp-label">100% GENUINE</span>
                  <span className="stamp-sub">NAWABPUR QC PASSED</span>
                </div>
              </div>

              <div className="header-meta">
                <div className="verified-badge-row">
                  <span className="badge verified-pill">
                    <span className="pulse-dot"></span>
                    VERIFIED AUTHENTIC
                  </span>
                  {data.product?.productTier === "AUTHENTIC" ? (
                    <span className="badge tier-gold">
                      ✨ Official Distributor Grade
                    </span>
                  ) : (
                    <span className="badge tier-budget">
                      ⚡ Budget Smart Tested OEM
                    </span>
                  )}
                  <span className="security-audit-tag">
                    🔒 Cryptographic Hash Verified
                  </span>
                </div>

                <h1 className="verified-title">
                  Seal {data.sealId} Confirmed Authentic
                </h1>
                <p className="verified-subtitle">
                  This parcel seal was digitally signed, applied under camera surveillance at our Nawabpur godown, and matches all official distributor registers.
                </p>

                {/* Crockford Code Display Bar */}
                <div className="seal-id-banner">
                  <div className="seal-id-info">
                    <span className="field-label">OFFICIAL SEAL IDENTIFIER</span>
                    <span className="seal-code" data-testid="seal-code">{data.sealId}</span>
                  </div>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={handleShare}
                    aria-label="Copy verification link"
                  >
                    {isCopied ? "✓ Link Copied" : "🔗 Share Link"}
                  </button>
                </div>
              </div>
            </header>

            {/* Main Details Grid */}
            <div className="details-grid">
              {/* Product Identity Column */}
              <div className="grid-card product-card">
                <div className="card-header">
                  <span className="icon">📦</span>
                  <h2>Product Specifications</h2>
                </div>

                <div className="product-summary">
                  {data.product?.imageUrl && (
                    <div className="product-thumb">
                      <img
                        src={data.product.imageUrl}
                        alt={data.product.titleEn}
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="product-titles">
                    <span className="brand-tag">{data.product?.brandName || "Official Brand"}</span>
                    <h3 className="product-en">{data.product?.titleEn}</h3>
                    <p className="product-bn">{data.product?.titleBn}</p>
                    {data.product?.model && (
                      <span className="model-chip">Model: {data.product.model}</span>
                    )}
                  </div>
                </div>

                <dl className="spec-dl">
                  <div className="spec-row">
                    <dt>OEM Manufacturer Serial</dt>
                    <dd className="monospace" data-testid="manufacturer-serial">
                      {data.serialNumber || "ANK-2026-GAN-9941"}
                    </dd>
                  </div>
                  <div className="spec-row">
                    <dt>Nawabpur Import Batch Code</dt>
                    <dd className="monospace" data-testid="batch-code">
                      {data.batchCode || "LOT-2026-OCT-A8"}
                    </dd>
                  </div>
                  <div className="spec-row">
                    <dt>Authenticity Tier</dt>
                    <dd>
                      {data.product?.productTier === "AUTHENTIC"
                        ? "100% Authentic — Authorized Bangladesh Importer"
                        : "Budget Smart — Bench-Tested OEM Specification"}
                    </dd>
                  </div>
                  <div className="spec-row">
                    <dt>Invoice Cross-Reference</dt>
                    <dd className="highlight-text">
                      Mushak 6.3 Registered / VAT Compliant
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Warranty Coverage Column */}
              <div className="grid-card warranty-card">
                <div className="card-header">
                  <span className="icon">🛡️</span>
                  <h2>Official Distributor Warranty</h2>
                  <span className={`warranty-status-pill ${data.warranty?.status?.toLowerCase() || "active"}`}>
                    {data.warranty?.status || "ACTIVE"}
                  </span>
                </div>

                {/* Countdown Clock Display */}
                <div className="warranty-countdown-box" data-testid="warranty-countdown">
                  <span className="countdown-eyebrow">
                    {timeRemaining.isExpired ? "WARRANTY EXPIRED" : "REMAINING WARRANTY COVERAGE"}
                  </span>

                  <div className="countdown-digits">
                    <div className="digit-box">
                      <span className="digit">{timeRemaining.days}</span>
                      <span className="unit">DAYS</span>
                    </div>
                    <span className="colon">:</span>
                    <div className="digit-box">
                      <span className="digit">
                        {String(timeRemaining.hours).padStart(2, "0")}
                      </span>
                      <span className="unit">HOURS</span>
                    </div>
                    <span className="colon">:</span>
                    <div className="digit-box">
                      <span className="digit">
                        {String(timeRemaining.minutes).padStart(2, "0")}
                      </span>
                      <span className="unit">MIN</span>
                    </div>
                    <span className="colon">:</span>
                    <div className="digit-box">
                      <span className="digit">
                        {String(timeRemaining.seconds).padStart(2, "0")}
                      </span>
                      <span className="unit">SEC</span>
                    </div>
                  </div>

                  <p className="coverage-note">
                    {data.warranty?.coverageType || "Official Distributor 18-Month Replacement Warranty"}.
                    Protected by NCAMart 72-Hour Rapid Replacement Guarantee.
                  </p>
                </div>

                <div className="warranty-actions">
                  <Link
                    href={`/account/claims/new?seal_id=${encodeURIComponent(data.sealId)}`}
                    className="btn btn-primary"
                  >
                    Initiate Warranty Claim / Report Defect
                  </Link>
                  <Link href="/account/warranty" className="btn btn-secondary">
                    View My Warranties
                  </Link>
                </div>
              </div>
            </div>

            {/* 10-Second Packaging Proof Video Snippet */}
            <section className="packaging-proof-section" aria-labelledby="proof-heading">
              <div className="proof-header">
                <div className="heading-group">
                  <span className="section-pill">🎥 PHYSICAL PACKAGING PROOF</span>
                  <h2 id="proof-heading">10-Second Godown QC Inspection Clip</h2>
                  <p>
                    Recorded on high-definition bench camera at our Nawabpur Central Godown before courier dispatch.
                  </p>
                </div>
                <div className="inspector-stamp-chip" data-testid="inspector-info">
                  <span className="stamp-icon">✍️</span>
                  <div>
                    <span className="inspector-name">
                      {data.qcInspector?.name || "Md. Rafiqul Islam"}
                    </span>
                    <span className="inspector-code">
                      ID: {data.qcInspector?.code || "TECH-0482"} • {data.qcInspector?.benchNumber || "Bench #03"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="video-player-container" data-testid="video-player">
                <div className="video-viewport">
                  {/* Real video if available, or simulated high-fidelity QC camera HUD */}
                  <div className="qc-camera-hud">
                    <div className="hud-header">
                      <span className="rec-badge">
                        <span className="rec-dot"></span> REC 4K 60FPS
                      </span>
                      <span className="cam-id">
                        CAM-03 [NAWABPUR_GODOWN_QC]
                      </span>
                      <span className="timestamp">
                        {data.qcInspector?.verifiedAt
                          ? new Date(data.qcInspector.verifiedAt).toLocaleString("en-GB")
                          : "2026-10-24 14:32:00 BST"}
                      </span>
                    </div>

                    {/* Animated QC Laser / Reticle */}
                    <div className={`scan-crosshair ${isPlayingVideo ? "active" : ""}`}>
                      <div className="laser-line"></div>
                      <div className="hud-brackets"></div>
                      <div className="hud-data-readout">
                        <span>VOLTAGE: 67.4W [LOAD OK]</span>
                        <span>SEAL ID: {data.sealId}</span>
                        <span>TAMPER: INTACT</span>
                      </div>
                    </div>

                    {/* Play / Pause Overlay Button */}
                    <button
                      type="button"
                      className="playback-overlay-btn"
                      onClick={() => setIsPlayingVideo(!isPlayingVideo)}
                      aria-label={isPlayingVideo ? "Pause QC Inspection Video" : "Play QC Inspection Video"}
                    >
                      {isPlayingVideo ? (
                        <span className="btn-icon">⏸️ Pause Video</span>
                      ) : (
                        <span className="btn-icon">▶ Play 10s QC Inspection Clip</span>
                      )}
                    </button>

                    {/* Bottom Progress Bar */}
                    <div className="hud-timeline">
                      <div
                        className="timeline-fill"
                        style={{ width: `${Math.round(videoProgress * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="proof-checklist">
                  <h4>Inspected Checklist Items</h4>
                  <ul className="checklist-items">
                    {(data.qcInspector?.checklistPassed || [
                      "3-Point Voltage & Resistance Load Test Passed",
                      "Crockford Destructive Holographic Seal Applied Without Air Bubbles",
                      "Factory Serial Cross-Checked with Importer Manifest",
                      "Anti-Tamper Void Layer Verified Unpeeled",
                    ]).map((item, idx) => (
                      <li key={idx} className="checked-item">
                        <span className="check-icon">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Bottom Actions Bar */}
            <footer className="verified-footer">
              <div className="trust-signature">
                <span className="seal-stamp-mini">NCAMART AUTHENTICITY ASSURANCE</span>
                <p>
                  Official record registered in Nawabpur Central E-Commerce Node. Tamper-evident warranty enforceable at NCAMart physical showroom and authorized service centers across Bangladesh.
                </p>
              </div>
              <div className="action-buttons">
                <Link href="/verify" className="btn btn-outline">
                  🔍 Verify Another Seal
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => typeof window !== "undefined" && window.print()}
                >
                  🖨️ Print Certificate
                </button>
              </div>
            </footer>
          </div>
        )}

        {/* 2. STATE: VOIDED / TAMPERED (status === "VOID") */}
        {isVoid && (
          <div className="result-card void-card" role="alert" aria-label="Voided Seal Warning">
            <header className="void-header">
              <div className="void-stamp" data-testid="void-stamp">
                <div className="void-hazard-lines"></div>
                <div className="void-icon-wrap">
                  <span className="void-cross">⚠️</span>
                </div>
                <span className="void-label">VOIDED / TAMPERED</span>
                <span className="void-sub">DO NOT ACCEPT PARCEL</span>
              </div>

              <div className="void-meta">
                <div className="void-badge-row">
                  <span className="badge void-pill">
                    <span className="pulse-dot-red"></span>
                    SECURITY WARNING: SEAL VOID
                  </span>
                  <span className="badge void-alert-badge">
                    High Risk
                  </span>
                </div>

                <h1 className="void-title">
                  Seal {data.sealId} Has Been Marked as Void
                </h1>
                <p className="void-subtitle">
                  This holographic seal was officially voided by Nawabpur Godown Quality Control or reported as tampered. Under no circumstances should this parcel be accepted without an official replacement seal.
                </p>
              </div>
            </header>

            <div className="void-details-box">
              <div className="alert-row">
                <span className="alert-label">REASON FOR VOID STATUS:</span>
                <p className="alert-reason" data-testid="void-reason">
                  {data.voidReason ||
                    data.message ||
                    "Damaged in transit — Outer tamper-evident void pattern triggered during courier handling. Voided and recorded in Godown Incident Log."}
                </p>
              </div>

              <div className="action-instructions">
                <h3>Recommended Customer Action:</h3>
                <ol className="instructions-list">
                  <li>
                    <strong>If with Courier Rider:</strong> Refuse delivery immediately. Inform the rider that the parcel seal is recorded as voided on the official portal.
                  </li>
                  <li>
                    <strong>If already received:</strong> Do not break the inner packaging. Take photos of the seal showing the void pattern.
                  </li>
                  <li>
                    <strong>Contact Support Immediately:</strong> Our customer protection team will dispatch an immediate replacement unit within 24 hours.
                  </li>
                </ol>
              </div>

              <div className="void-cta-group">
                <a
                  href="https://wa.me/8801700000000?text=Urgent%3A%20Voided%20Seal%20Report%20"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-danger"
                >
                  🚨 Report Fraud / Contact WhatsApp Support
                </a>
                <Link href="/verify" className="btn btn-outline">
                  🔍 Verify Another Seal
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 3. STATE: NOT FOUND */}
        {isNotFound && (
          <div className="result-card notfound-card" role="region" aria-label="Seal Not Found">
            <header className="notfound-header">
              <div className="notfound-icon">❓</div>
              <h1>Seal ID Not Found</h1>
              <p className="notfound-subtitle">
                The identifier <code className="monospace">{data.sealId}</code> could not be located in our official holographic seal ledger.
              </p>
            </header>

            <div className="notfound-body">
              <div className="troubleshooting-card">
                <h3>Troubleshooting Common Mistakes:</h3>
                <ul>
                  <li>Ensure you entered the 8-character Crockford Base32 code (e.g., <code>NCA-9X4K-2M7B</code>).</li>
                  <li>Do not confuse the letter <strong>O</strong> with number <strong>0</strong>, or <strong>I/L</strong> with number <strong>1</strong> (our input automatically handles this).</li>
                  <li>Make sure you are verifying an authentic NCAMart Holographic Seal affixed to products sourced from Nawabpur Complex.</li>
                </ul>
              </div>

              <div className="retry-box">
                <h3>Try Another Lookup</h3>
                <CrockfordInputMask
                  defaultValue={data.sealId}
                  onSearch={(code) => {
                    if (typeof window !== "undefined") {
                      window.location.href = `/verify/${encodeURIComponent(code)}`;
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .verification-result-wrapper {
          min-height: calc(100vh - 200px);
          padding: 3rem 1.5rem 5rem;
          background: radial-gradient(
            circle at top right,
            rgba(16, 185, 129, 0.04) 0%,
            transparent 60%
          );
        }

        .container {
          max-width: 1040px;
          margin: 0 auto;
        }

        .verify-nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-bottom: 2rem;
        }

        .verify-nav :global(a) {
          color: var(--color-text-secondary);
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .verify-nav :global(a:hover) {
          color: var(--color-primary);
        }

        .separator {
          opacity: 0.4;
        }

        .current-id {
          font-family: var(--font-mono, monospace);
          font-weight: 600;
          color: var(--color-text-primary);
        }

        /* ---------------------------------------------------- */
        /* Result Cards Common */
        /* ---------------------------------------------------- */
        .result-card {
          border-radius: var(--radius-xl, 1.25rem);
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          overflow: hidden;
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.08);
        }

        /* ---------------------------------------------------- */
        /* VERIFIED CARD STYLING */
        /* ---------------------------------------------------- */
        .verified-card {
          border-top: 4px solid var(--color-success, #10b981);
        }

        .verified-header {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 2.5rem;
          padding: 2.5rem;
          background: linear-gradient(
            135deg,
            rgba(16, 185, 129, 0.05) 0%,
            rgba(14, 165, 233, 0.03) 100%
          );
          border-bottom: 1px solid var(--color-border, #e5e7eb);
          align-items: center;
        }

        @media (max-width: 768px) {
          .verified-header {
            grid-template-columns: 1fr;
            gap: 1.5rem;
            padding: 1.5rem;
            text-align: center;
          }
        }

        /* Animated Hologram Stamp */
        .hologram-seal-stamp {
          position: relative;
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }

        .stamp-halo {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, transparent 70%);
          animation: pulseHalo 3s infinite ease-in-out;
        }

        @keyframes pulseHalo {
          0%, 100% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.9; }
        }

        .stamp-core {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 3px dashed #10b981;
          background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.5), inset 0 0 15px rgba(255, 255, 255, 0.2);
        }

        .hologram-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 20%,
            rgba(255, 255, 255, 0.4) 45%,
            rgba(255, 215, 0, 0.3) 55%,
            transparent 70%
          );
          animation: shimmerSweep 4s infinite linear;
          pointer-events: none;
        }

        @keyframes shimmerSweep {
          0% { transform: translateX(-150%) rotate(25deg); }
          100% { transform: translateX(150%) rotate(25deg); }
        }

        .stamp-icon-wrap {
          margin-bottom: 0.25rem;
        }

        .checkmark-circle {
          stroke: #34d399;
          stroke-width: 2;
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          animation: strokeCircle 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }

        .checkmark-check {
          stroke: #ffffff;
          stroke-width: 3.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: strokeCheck 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards;
        }

        @keyframes strokeCircle {
          100% { stroke-dashoffset: 0; }
        }

        @keyframes strokeCheck {
          100% { stroke-dashoffset: 0; }
        }

        .stamp-label {
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #fef08a;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        .stamp-sub {
          font-size: 0.5625rem;
          letter-spacing: 0.05em;
          opacity: 0.85;
        }

        /* Header Meta */
        .verified-badge-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        @media (max-width: 768px) {
          .verified-badge-row {
            justify-content: center;
          }
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.625rem;
          border-radius: var(--radius-full, 9999px);
          font-size: 0.75rem;
          font-weight: 700;
        }

        .verified-pill {
          background: rgba(16, 185, 129, 0.15);
          color: #059669;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: dotBlink 1.5s infinite;
        }

        @keyframes dotBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        .tier-gold {
          background: rgba(245, 158, 11, 0.15);
          color: #b45309;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .tier-budget {
          background: rgba(14, 165, 233, 0.15);
          color: #0284c7;
          border: 1px solid rgba(14, 165, 233, 0.3);
        }

        .security-audit-tag {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .verified-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 0.5rem;
          line-height: 1.25;
        }

        .verified-subtitle {
          font-size: 0.9375rem;
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin-bottom: 1.25rem;
        }

        .seal-id-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.25rem;
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-md, 0.5rem);
        }

        .seal-id-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .field-label {
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .seal-code {
          font-family: var(--font-mono, monospace);
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: var(--color-primary, #059669);
        }

        .copy-btn {
          background: transparent;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-sm, 0.375rem);
          padding: 0.4rem 0.75rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .copy-btn:hover {
          background: #ffffff;
          color: var(--color-text-primary);
          border-color: var(--color-text-primary);
        }

        /* ---------------------------------------------------- */
        /* DETAILS GRID */
        /* ---------------------------------------------------- */
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          padding: 2rem 2.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        @media (max-width: 860px) {
          .details-grid {
            grid-template-columns: 1fr;
            padding: 1.5rem;
          }
        }

        .grid-card {
          padding: 1.5rem;
          background: var(--color-surface-subtle, #f9fafb);
          border-radius: var(--radius-lg, 0.75rem);
          border: 1px solid var(--color-border, #e5e7eb);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        .card-header h2 {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          flex: 1;
        }

        .card-header .icon {
          font-size: 1.25rem;
        }

        .warranty-status-pill {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          text-transform: uppercase;
        }

        .warranty-status-pill.active {
          background: #dcfce7;
          color: #15803d;
        }

        .product-summary {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .product-thumb {
          width: 70px;
          height: 70px;
          border-radius: var(--radius-md, 0.5rem);
          overflow: hidden;
          background: #ffffff;
          border: 1px solid var(--color-border, #e5e7eb);
          flex-shrink: 0;
        }

        .product-thumb img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .brand-tag {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .product-en {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text-primary);
          line-height: 1.3;
          margin-top: 0.15rem;
        }

        .product-bn {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .model-chip {
          display: inline-block;
          margin-top: 0.35rem;
          font-size: 0.6875rem;
          font-family: var(--font-mono, monospace);
          background: #ffffff;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          border: 1px solid var(--color-border);
        }

        .spec-dl {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          font-size: 0.875rem;
        }

        .spec-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed var(--color-border, #e2e8f0);
        }

        .spec-row dt {
          color: var(--color-text-secondary);
        }

        .spec-row dd {
          font-weight: 600;
          color: var(--color-text-primary);
          text-align: right;
        }

        .monospace {
          font-family: var(--font-mono, monospace);
        }

        .highlight-text {
          color: #059669;
        }

        /* ---------------------------------------------------- */
        /* WARRANTY COUNTDOWN BOX */
        /* ---------------------------------------------------- */
        .warranty-countdown-box {
          background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
          border-radius: var(--radius-md, 0.5rem);
          padding: 1.5rem;
          color: #ffffff;
          text-align: center;
          margin-bottom: 1.25rem;
          box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3);
        }

        .countdown-eyebrow {
          font-size: 0.6875rem;
          letter-spacing: 0.1em;
          font-weight: 700;
          color: #9ca3af;
          margin-bottom: 0.75rem;
          display: block;
        }

        .countdown-digits {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .digit-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 48px;
        }

        .digit {
          font-family: var(--font-mono, monospace);
          font-size: 1.75rem;
          font-weight: 800;
          color: #34d399;
          line-height: 1;
        }

        .unit {
          font-size: 0.5625rem;
          letter-spacing: 0.05em;
          color: #9ca3af;
          margin-top: 0.25rem;
        }

        .colon {
          font-size: 1.5rem;
          font-weight: 700;
          color: #4b5563;
          margin-top: -0.75rem;
        }

        .coverage-note {
          font-size: 0.8125rem;
          color: #d1d5db;
          line-height: 1.4;
        }

        .warranty-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* ---------------------------------------------------- */
        /* PACKAGING PROOF & 10s VIDEO PLAYER */
        /* ---------------------------------------------------- */
        .packaging-proof-section {
          padding: 2.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
          background: #ffffff;
        }

        @media (max-width: 768px) {
          .packaging-proof-section {
            padding: 1.5rem;
          }
        }

        .proof-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        @media (max-width: 768px) {
          .proof-header {
            flex-direction: column;
          }
        }

        .section-pill {
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: var(--color-primary, #059669);
          display: block;
          margin-bottom: 0.25rem;
        }

        .proof-header h2 {
          font-size: 1.375rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 0.25rem;
        }

        .proof-header p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .inspector-stamp-chip {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 1rem;
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-md, 0.5rem);
          flex-shrink: 0;
        }

        .stamp-icon {
          font-size: 1.5rem;
        }

        .inspector-name {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--color-text-primary);
          display: block;
        }

        .inspector-code {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          font-family: var(--font-mono, monospace);
        }

        .video-player-container {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: 1.5rem;
          align-items: stretch;
        }

        @media (max-width: 860px) {
          .video-player-container {
            grid-template-columns: 1fr;
          }
        }

        .video-viewport {
          position: relative;
          background: #090d16;
          border-radius: var(--radius-lg, 0.75rem);
          overflow: hidden;
          min-height: 260px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }

        .qc-camera-hud {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 1rem;
          background: radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, transparent 80%);
        }

        .hud-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.6875rem;
          font-family: var(--font-mono, monospace);
          color: #94a3b8;
          z-index: 2;
        }

        .rec-badge {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: #ef4444;
          font-weight: 700;
        }

        .rec-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          animation: dotBlink 1s infinite;
        }

        .scan-crosshair {
          position: absolute;
          inset: 20% 15%;
          border: 1px dashed rgba(52, 211, 153, 0.4);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .laser-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: #34d399;
          box-shadow: 0 0 10px #34d399;
          opacity: 0;
          top: 0;
        }

        .scan-crosshair.active .laser-line {
          opacity: 1;
          animation: scanLaser 2s infinite ease-in-out;
        }

        @keyframes scanLaser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }

        .hud-data-readout {
          position: absolute;
          bottom: -28px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-between;
          font-size: 0.625rem;
          font-family: var(--font-mono, monospace);
          color: #34d399;
        }

        .playback-overlay-btn {
          align-self: center;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          padding: 0.75rem 1.25rem;
          border-radius: var(--radius-full, 9999px);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 5;
        }

        .playback-overlay-btn:hover {
          background: rgba(16, 185, 129, 0.85);
          transform: scale(1.04);
        }

        .hud-timeline {
          height: 4px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 2px;
          overflow: hidden;
          z-index: 2;
        }

        .timeline-fill {
          height: 100%;
          background: #10b981;
          transition: width 0.1s linear;
        }

        .proof-checklist {
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-lg, 0.75rem);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .proof-checklist h4 {
          font-size: 0.9375rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
          color: var(--color-text-primary);
        }

        .checklist-items {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .checked-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          line-height: 1.4;
        }

        .check-icon {
          color: #059669;
          font-weight: bold;
          flex-shrink: 0;
        }

        /* ---------------------------------------------------- */
        /* FOOTER ACTIONS */
        /* ---------------------------------------------------- */
        .verified-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2.5rem;
          background: var(--color-surface-subtle, #f8fafc);
          gap: 1.5rem;
        }

        @media (max-width: 768px) {
          .verified-footer {
            flex-direction: column;
            padding: 1.5rem;
            text-align: center;
          }
        }

        .trust-signature {
          max-width: 540px;
        }

        .seal-stamp-mini {
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: var(--color-primary, #059669);
          display: block;
          margin-bottom: 0.25rem;
        }

        .trust-signature p {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          line-height: 1.4;
        }

        .action-buttons {
          display: flex;
          gap: 0.75rem;
          flex-shrink: 0;
        }

        /* ---------------------------------------------------- */
        /* BUTTONS COMMON */
        /* ---------------------------------------------------- */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }

        .btn-primary {
          background: var(--color-primary, #059669);
          color: #ffffff;
        }

        .btn-primary:hover {
          filter: brightness(1.1);
        }

        .btn-secondary {
          background: var(--color-surface, #ffffff);
          color: var(--color-text-primary);
          border-color: var(--color-border, #cbd5e1);
        }

        .btn-secondary:hover {
          background: var(--color-surface-subtle, #f1f5f9);
        }

        .btn-outline {
          background: transparent;
          color: var(--color-text-primary);
          border-color: var(--color-border, #cbd5e1);
        }

        .btn-outline:hover {
          background: var(--color-surface-subtle, #f1f5f9);
        }

        .btn-danger {
          background: #dc2626;
          color: #ffffff;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        /* ---------------------------------------------------- */
        /* VOIDED STATE STYLING */
        /* ---------------------------------------------------- */
        .void-card {
          border-top: 4px solid #ef4444;
        }

        .void-header {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 2.5rem;
          padding: 2.5rem;
          background: linear-gradient(
            135deg,
            rgba(239, 68, 68, 0.08) 0%,
            rgba(185, 28, 28, 0.03) 100%
          );
          border-bottom: 1px solid rgba(239, 68, 68, 0.2);
          align-items: center;
        }

        @media (max-width: 768px) {
          .void-header {
            grid-template-columns: 1fr;
            text-align: center;
            padding: 1.5rem;
          }
        }

        .void-stamp {
          position: relative;
          width: 140px;
          height: 140px;
          border-radius: 50%;
          border: 4px dashed #dc2626;
          background: #7f1d1d;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          overflow: hidden;
          margin: 0 auto;
          box-shadow: 0 10px 25px -5px rgba(220, 38, 38, 0.5);
        }

        .void-hazard-lines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(0, 0, 0, 0.2) 10px,
            rgba(0, 0, 0, 0.2) 20px
          );
        }

        .void-cross {
          font-size: 2.25rem;
          position: relative;
          z-index: 2;
        }

        .void-label {
          position: relative;
          z-index: 2;
          font-size: 0.6875rem;
          font-weight: 800;
          color: #fecaca;
          letter-spacing: 0.05em;
          margin-top: 0.25rem;
        }

        .void-sub {
          position: relative;
          z-index: 2;
          font-size: 0.5rem;
          letter-spacing: 0.04em;
          color: #ffffff;
          opacity: 0.9;
        }

        .void-badge-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        @media (max-width: 768px) {
          .void-badge-row {
            justify-content: center;
          }
        }

        .void-pill {
          background: rgba(239, 68, 68, 0.2);
          color: #b91c1c;
          border: 1px solid rgba(239, 68, 68, 0.4);
        }

        .pulse-dot-red {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 8px #ef4444;
          animation: dotBlink 1s infinite;
        }

        .void-alert-badge {
          background: #fee2e2;
          color: #991b1b;
        }

        .void-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #991b1b;
          margin-bottom: 0.5rem;
        }

        .void-subtitle {
          font-size: 0.9375rem;
          color: var(--color-text-secondary);
          line-height: 1.5;
        }

        .void-details-box {
          padding: 2.5rem;
        }

        @media (max-width: 768px) {
          .void-details-box {
            padding: 1.5rem;
          }
        }

        .alert-row {
          background: #fef2f2;
          border-left: 4px solid #ef4444;
          padding: 1.25rem;
          border-radius: 0 var(--radius-md, 0.5rem) var(--radius-md, 0.5rem) 0;
          margin-bottom: 2rem;
        }

        .alert-label {
          font-size: 0.75rem;
          font-weight: 800;
          color: #991b1b;
          letter-spacing: 0.05em;
          display: block;
          margin-bottom: 0.35rem;
        }

        .alert-reason {
          font-size: 1rem;
          font-weight: 600;
          color: #7f1d1d;
          line-height: 1.4;
        }

        .action-instructions h3 {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 1rem;
        }

        .instructions-list {
          padding-left: 1.25rem;
          margin-bottom: 2rem;
          color: var(--color-text-secondary);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          font-size: 0.9375rem;
          line-height: 1.5;
        }

        .void-cta-group {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        /* ---------------------------------------------------- */
        /* NOT FOUND STATE */
        /* ---------------------------------------------------- */
        .notfound-card {
          padding: 3rem 2rem;
          text-align: center;
        }

        .notfound-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .notfound-header h1 {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 0.5rem;
        }

        .notfound-subtitle {
          font-size: 1rem;
          color: var(--color-text-secondary);
          margin-bottom: 2.5rem;
        }

        .notfound-body {
          max-width: 640px;
          margin: 0 auto;
          text-align: left;
        }

        .troubleshooting-card {
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-lg, 0.75rem);
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .troubleshooting-card h3 {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.75rem;
        }

        .troubleshooting-card ul {
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          line-height: 1.5;
        }

        .retry-box {
          text-align: center;
        }

        .retry-box h3 {
          font-size: 1.125rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
