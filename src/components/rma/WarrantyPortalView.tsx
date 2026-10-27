"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  calculateRemainingDays,
  type ActiveWarranty,
} from "./types";

interface WarrantyPortalViewProps {
  initialWarranties: ActiveWarranty[];
}

export function WarrantyPortalView({ initialWarranties }: WarrantyPortalViewProps) {
  const [warranties] = useState<ActiveWarranty[]>(initialWarranties);

  return (
    <div className="warranty-portal-view" role="region" aria-label="Customer Warranties & Claims">
      {/* SLA Assurance Banner */}
      <aside className="sla-banner" role="complementary" aria-label="RMA SLA Assurance">
        <div className="sla-badge">
          <span className="sla-icon">⚡</span>
          <span>RAPID DOORSTEP SWAP</span>
        </div>
        <div className="sla-text">
          <h2>NCAMart RMA Guarantee</h2>
          <p>
            Claims reviewed within <strong>1 business hour</strong>. Dhaka doorstep defect swap within{" "}
            <strong>72 hours</strong>. Nationwide courier pickup covered 100% by NCAMart.
          </p>
        </div>
      </aside>

      {/* Header */}
      <header className="portal-header">
        <div>
          <h1>Active Warranties &amp; Defect Claims</h1>
          <p>
            Track remaining warranty periods for your authentic products and initiate doorstep replacement claims.
          </p>
        </div>
        <Link href="/account/warranty/claim" className="btn btn-primary" data-testid="new-claim-button">
          ➕ Report Defect / File New Claim
        </Link>
      </header>

      {/* Warranties Grid */}
      {warranties.length === 0 ? (
        <div className="zero-warranties-card">
          <span className="zero-icon">🛡️</span>
          <h3>No Active Warranties Found</h3>
          <p>When your delivered products arrive and seals are verified, warranties will appear here.</p>
          <Link href="/products" className="btn btn-primary">
            Browse Authentic Gear
          </Link>
        </div>
      ) : (
        <div className="warranties-grid">
          {warranties.map((warranty) => {
            const remaining = calculateRemainingDays(warranty.expiresAt);

            return (
              <article key={warranty.id} className="warranty-card" data-testid="warranty-card">
                <div className="card-top">
                  <div className="product-thumb-wrap">
                    {warranty.imageUrl ? (
                      <img
                        src={warranty.imageUrl}
                        alt={warranty.productTitleEn}
                        className="product-thumb"
                      />
                    ) : (
                      <div className="product-thumb placeholder">🛡️</div>
                    )}
                  </div>

                  <div className="product-titles">
                    <span className="brand-label">{warranty.brandName}</span>
                    <h3 className="title-en">{warranty.productTitleEn}</h3>
                    <p className="title-bn">{warranty.productTitleBn}</p>
                  </div>
                </div>

                <div className="warranty-badge-row">
                  <span
                    className={`coverage-badge ${
                      warranty.coverageType.includes("OFFICIAL") ? "badge-official" : "badge-ncamart"
                    }`}
                  >
                    {warranty.coverageLabel}
                  </span>

                  <span
                    className={`remaining-pill ${remaining.isExpired ? "expired" : "active"}`}
                    data-testid="remaining-days-pill"
                  >
                    {remaining.isExpired ? "Expired" : `⏳ ${remaining.days} Days Remaining`}
                  </span>
                </div>

                {/* Specs / Seal IDs */}
                <dl className="warranty-specs">
                  <div className="spec-row">
                    <dt>Holographic Seal ID</dt>
                    <dd>
                      <Link
                        href={`/verify/${encodeURIComponent(warranty.sealId)}`}
                        className="seal-link"
                        title="Verify this holographic seal"
                      >
                        {warranty.sealId} ↗
                      </Link>
                    </dd>
                  </div>
                  <div className="spec-row">
                    <dt>OEM Serial Number</dt>
                    <dd className="monospace">{warranty.serialNumber}</dd>
                  </div>
                  <div className="spec-row">
                    <dt>Delivered On</dt>
                    <dd>
                      {new Date(warranty.deliveredAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </dd>
                  </div>
                </dl>

                {/* Card Actions */}
                <div className="card-actions">
                  <Link
                    href={`/account/warranty/claim?sealId=${encodeURIComponent(warranty.sealId)}`}
                    className={`btn ${remaining.isExpired ? "btn-disabled" : "btn-claim"}`}
                    aria-disabled={remaining.isExpired}
                    data-testid="claim-warranty-button"
                  >
                    Claim Warranty / Report Defect
                  </Link>
                  <Link
                    href={`/verify/${encodeURIComponent(warranty.sealId)}`}
                    className="btn btn-outline"
                  >
                    Inspect Seal
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .warranty-portal-view {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        /* SLA Assurance Banner */
        .sla-banner {
          background: linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 1.75rem 2rem;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.4);
        }

        @media (max-width: 640px) {
          .sla-banner {
            flex-direction: column;
            align-items: flex-start;
            padding: 1.5rem;
          }
        }

        .sla-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 0.5rem 0.875rem;
          border-radius: 9999px;
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #fef08a;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .sla-icon { font-size: 1rem; }

        .sla-text h2 {
          font-size: 1.125rem;
          font-weight: 800;
          margin-bottom: 0.25rem;
          color: #ffffff;
        }

        .sla-text p {
          font-size: 0.875rem;
          color: #d1fae5;
          line-height: 1.4;
        }

        .sla-text strong {
          color: #ffffff;
          text-decoration: underline;
          text-decoration-color: #34d399;
        }

        /* Portal Header */
        .portal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        @media (max-width: 640px) {
          .portal-header {
            flex-direction: column;
          }
        }

        .portal-header h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 0.25rem;
        }

        .portal-header p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        /* Warranties Grid */
        .warranties-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .warranty-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1.25rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          transition: all 0.2s ease;
        }

        .warranty-card:hover {
          border-color: #059669;
          box-shadow: 0 8px 24px rgba(5, 150, 105, 0.08);
        }

        .card-top {
          display: flex;
          gap: 1rem;
        }

        .product-thumb-wrap {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-md, 0.5rem);
          overflow: hidden;
          background: #ffffff;
          border: 1px solid var(--color-border, #e5e7eb);
          flex-shrink: 0;
        }

        .product-thumb {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .product-thumb.placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          background: var(--color-surface-subtle, #f8fafc);
        }

        .product-titles {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .brand-label {
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-secondary);
        }

        .title-en {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text-primary);
          line-height: 1.3;
        }

        .title-bn {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .warranty-badge-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .coverage-badge {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
        }

        .badge-official {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .badge-ncamart {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .remaining-pill {
          font-size: 0.75rem;
          font-weight: 800;
          padding: 0.2rem 0.625rem;
          border-radius: 9999px;
        }

        .remaining-pill.active {
          background: #dcfce7;
          color: #15803d;
        }

        .remaining-pill.expired {
          background: #fee2e2;
          color: #991b1b;
        }

        .warranty-specs {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.8125rem;
          padding: 0.75rem 1rem;
          background: var(--color-surface-subtle, #f8fafc);
          border-radius: var(--radius-md, 0.5rem);
          border: 1px solid var(--color-border, #e2e8f0);
        }

        .spec-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .spec-row dt { color: var(--color-text-secondary); }
        .spec-row dd { font-weight: 600; color: var(--color-text-primary); }

        .seal-link {
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          color: #059669;
          text-decoration: none;
        }

        .seal-link:hover { text-decoration: underline; }
        .monospace { font-family: var(--font-mono, monospace); }

        .card-actions {
          display: flex;
          gap: 0.75rem;
        }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.8125rem;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .btn-claim {
          background: #059669;
          color: #ffffff;
          border: none;
          flex: 1;
        }

        .btn-claim:hover { background: #047857; }

        .btn-disabled {
          background: var(--color-surface-subtle, #f8fafc);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border, #cbd5e1);
          cursor: not-allowed;
          flex: 1;
        }

        .btn-outline {
          background: transparent;
          color: var(--color-text-primary);
          border: 1px solid var(--color-border, #cbd5e1);
        }

        .btn-outline:hover { background: var(--color-surface-subtle, #f8fafc); }

        .btn-primary {
          background: #059669;
          color: #ffffff;
          border: none;
        }

        .zero-warranties-card {
          padding: 4rem 2rem;
          text-align: center;
          background: var(--color-surface, #ffffff);
          border: 1px dashed var(--color-border, #cbd5e1);
          border-radius: var(--radius-xl, 1.25rem);
          color: var(--color-text-secondary);
        }

        .zero-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
