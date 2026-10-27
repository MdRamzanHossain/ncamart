"use client";

import React from "react";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";
import {
  PreOrderItem,
  DepositBreakdown,
  PreOrderQuotaBar,
  MilestoneTracker,
  PreOrderPolicyBanner,
} from "@/components/preorder";
import { HolographicSealPreview } from "@/components/trust";
import { PreOrderPDPClient } from "@/app/pre-orders/[slug]/PreOrderPDPClient";

export interface PreOrderPDPViewProps {
  item: PreOrderItem;
  breakdown: DepositBreakdown;
}

export function PreOrderPDPView({ item, breakdown }: PreOrderPDPViewProps) {
  return (
    <StorefrontShell>
      <div className="preorder-pdp-root">
        {/* Breadcrumb Navigation */}
        <div className="pdp-breadcrumbs">
          <div className="breadcrumb-inner">
            <Link href="/" className="crumb-link">Home</Link>
            <span className="crumb-sep">/</span>
            <Link href="/pre-orders" className="crumb-link">Pre-Orders</Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">{item.title_en}</span>
          </div>
        </div>

        <main className="pdp-content-main">
          <div className="pdp-container">
            {/* Top Grid: Gallery / Trust Seal & Order Configurator */}
            <div className="pdp-top-grid">
              {/* Left Column: Visual Media & 3D Holographic Seal */}
              <div className="media-trust-column">
                <div className="main-image-placeholder">
                  <div className="origin-hub-tag">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
                    </svg>
                    Direct Flight from {item.origin_hub}
                  </div>
                  <div className="center-media-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5">
                      <rect x="2" y="2" width="20" height="20" rx="2" />
                      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
                    </svg>
                    <span className="media-label">{item.brand_name} Official Engineering Sample</span>
                  </div>
                </div>

                {/* 3D Interactive Tamper Holographic Seal Preview */}
                <div className="seal-preview-box">
                  <HolographicSealPreview
                    sealId={`NC-PREO-${item.slug.slice(0, 4).toUpperCase()}`}
                    productTier="AUTHENTIC"
                    brandName={item.brand_name}
                    title={item.title_en}
                    qcDate="Scheduled upon Godown Arrival"
                  />
                </div>
              </div>

              {/* Right Column: Title, Quota Bar, Interactive Deposit Calculator, Reservation CTA */}
              <div className="configurator-column">
                <div className="brand-tier-row">
                  <span className="tier-badge-auth">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Direct Import Authentic
                  </span>
                  <span className="btrc-badge">BTRC NOC Cleared</span>
                  <span className="sku-tag">{item.sku_code}</span>
                </div>

                <h1 className="pdp-title">{item.title_en}</h1>
                <p className="pdp-title-bn">{item.title_bn}</p>

                {/* Target Quota Progress Bar */}
                <div className="quota-widget-wrap">
                  <PreOrderQuotaBar
                    reserved={item.reserved_quota}
                    target={item.target_quota}
                    batchCode={item.batch_code}
                  />
                </div>

                {/* Customs Clearance & Arrival Window Callout */}
                <div className="arrival-window-callout">
                  <div className="arrival-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <span className="arrival-label">Estimated Customs Clearance & Arrival:</span>
                    <div className="arrival-dates">{item.estimated_arrival_window}</div>
                    <span className="arrival-sub">Direct Air Cargo to Dhaka Hazrat Shahjalal International Airport</span>
                  </div>
                </div>

                {/* Client Side Interactive Deposit Calculator & Reserve Button */}
                <PreOrderPDPClient item={item} breakdown={breakdown} />
              </div>
            </div>

            {/* Middle Section: Milestone Journey Tracker */}
            <div className="section-divider-block">
              <MilestoneTracker
                currentStageIndex={1}
                arrivalWindow={item.estimated_arrival_window}
                batchCode={item.batch_code}
              />
            </div>

            {/* Specifications & Highlights Table */}
            <div className="specs-section-grid">
              <div className="specs-card">
                <h3 className="section-subtitle">Technical Specifications</h3>
                <table className="specs-table">
                  <tbody>
                    {item.specs.map((s, idx) => (
                      <tr key={idx}>
                        <td className="spec-label">{s.label}</td>
                        <td className="spec-value">{s.value}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="spec-label">Warranty Coverage</td>
                      <td className="spec-value">{item.warranty_days} Days Assisted Replacement via NCAMart</td>
                    </tr>
                    <tr>
                      <td className="spec-label">Inspection Standard</td>
                      <td className="spec-value">Tamper-Evident Destructive VOID Seal Applied at Godown</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="highlights-card">
                <h3 className="section-subtitle">Key Highlights & Protections</h3>
                <ul className="highlights-list">
                  {item.highlights.map((h, idx) => (
                    <li key={idx} className="highlight-item">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Explicit Policy Banner */}
            <div className="bottom-policy-wrap">
              <PreOrderPolicyBanner />
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        .preorder-pdp-root {
          min-height: 100vh;
          background: var(--color-bg-canvas, #090d16);
          color: var(--color-text-primary, #f9fafb);
        }

        .pdp-breadcrumbs {
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
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 400px;
        }

        .pdp-content-main {
          padding: 2.5rem 1.5rem 4rem;
        }

        .pdp-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .pdp-top-grid {
          display: grid;
          grid-template-columns: 1fr 1.15fr;
          gap: 2.5rem;
          align-items: start;
        }

        .media-trust-column {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .main-image-placeholder {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          height: 320px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .origin-hub-tag {
          position: absolute;
          top: 1rem;
          left: 1rem;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #93c5fd;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          backdrop-filter: blur(8px);
        }

        .center-media-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          color: #9ca3af;
        }

        .media-label {
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .seal-preview-box {
          border-radius: 1rem;
          overflow: hidden;
        }

        .configurator-column {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .brand-tier-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
        }

        .tier-badge-auth {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: #6ee7b7;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
        }

        .btrc-badge {
          font-size: 0.725rem;
          font-weight: 600;
          color: #93c5fd;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.25);
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
        }

        .sku-tag {
          font-size: 0.725rem;
          font-family: var(--font-mono, monospace);
          color: #9ca3af;
        }

        .pdp-title {
          font-size: clamp(1.35rem, 3vw, 1.75rem);
          font-weight: 800;
          line-height: 1.3;
          color: #f9fafb;
          margin: 0;
        }

        .pdp-title-bn {
          font-size: 0.9375rem;
          color: #9ca3af;
          margin: 0;
        }

        .quota-widget-wrap {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 1rem;
        }

        .arrival-window-callout {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 0.75rem;
          padding: 1rem;
        }

        .arrival-icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 0.5rem;
          background: rgba(59, 130, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .arrival-label {
          font-size: 0.75rem;
          color: #93c5fd;
          font-weight: 600;
          display: block;
        }

        .arrival-dates {
          font-size: 1.125rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0.15rem 0;
        }

        .arrival-sub {
          font-size: 0.75rem;
          color: #9ca3af;
          display: block;
        }

        .section-divider-block {
          width: 100%;
        }

        .specs-section-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .specs-card, .highlights-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          padding: 1.5rem;
        }

        .section-subtitle {
          font-size: 1.0625rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0 0 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 0.625rem;
        }

        .specs-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.84rem;
        }

        .specs-table td {
          padding: 0.625rem 0.25rem;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.06);
        }

        .spec-label {
          color: #9ca3af;
          width: 45%;
        }

        .spec-value {
          color: #e5e7eb;
          font-weight: 600;
        }

        .highlights-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        .highlight-item {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          font-size: 0.875rem;
          color: #d1d5db;
          line-height: 1.45;
        }

        .bottom-policy-wrap {
          margin-top: 1rem;
        }

        @media (max-width: 900px) {
          .pdp-top-grid {
            grid-template-columns: 1fr;
          }
          .specs-section-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </StorefrontShell>
  );
}
