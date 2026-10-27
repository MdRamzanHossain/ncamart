"use client";

import React, { useState } from "react";

export function PreOrderPolicyBanner() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="policy-banner-wrap">
      <div className="policy-main-bar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="policy-icon-title">
          <div className="shield-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h4 className="policy-main-heading">
              100% Refund SLA Guarantee & Transparent Pre-Order Terms
            </h4>
            <p className="policy-summary">
              100% Refund if import delayed beyond SLA (+7 days). Deposit forfeiture terms apply if arrival balance remains unpaid after 7 days.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="toggle-btn"
          aria-expanded={isExpanded}
          aria-label="Toggle terms details"
        >
          <span>{isExpanded ? "Hide Details" : "Read Terms"}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Expandable Terms Grid */}
      {isExpanded && (
        <div className="policy-details-grid">
          <div className="policy-card">
            <div className="card-badge green-badge">SLA Protection</div>
            <h5 className="card-title">Air Cargo Delay Guarantee</h5>
            <p className="card-body">
              If an import is delayed beyond the confirmed ETA window + 7 calendar days, you may cancel instantly with a 100% full refund to your original payment method within 24 hours, or keep the order and receive a ৳1,000 store credit upon arrival.
            </p>
          </div>

          <div className="policy-card">
            <div className="card-badge blue-badge">Stockout Protection</div>
            <h5 className="card-title">Factory Stockout or Customs Halt</h5>
            <p className="card-body">
              In the rare event of international manufacturer stockout or regulatory import embargo, NCAMart guarantees 100% deposit refund within 7 working days, or the option to switch to an alternative high-spec SKU at preferential pricing.
            </p>
          </div>

          <div className="policy-card">
            <div className="card-badge yellow-badge">Cancellation Window</div>
            <h5 className="card-title">Pre-Flight vs Post-Flight Rules</h5>
            <p className="card-body">
              Cancellations requested before international cargo flight booking are entitled to a 100% refund. Once air cargo is in flight and booked with customs manifests, deposits become non-refundable to cover reserved freight payload.
            </p>
          </div>

          <div className="policy-card">
            <div className="card-badge amber-badge">Godown Arrival</div>
            <h5 className="card-title">7-Day Arrival Balance Window</h5>
            <p className="card-body">
              Upon safe arrival and QC passing at Nawabpur Godown, an SMS & WhatsApp notification is dispatched. Customers have 7 full calendar days to settle the remaining balance. After Day 7, unclaimed units are re-listed and deposit is credited minus a 10% restocking fee.
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .policy-banner-wrap {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 1rem;
          overflow: hidden;
          transition: border-color 0.2s ease;
        }

        .policy-banner-wrap:hover {
          border-color: rgba(16, 185, 129, 0.45);
        }

        .policy-main-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1.125rem 1.25rem;
          cursor: pointer;
        }

        .policy-icon-title {
          display: flex;
          align-items: flex-start;
          gap: 0.875rem;
        }

        .shield-icon {
          width: 36px;
          height: 36px;
          border-radius: 0.5rem;
          background: rgba(16, 185, 129, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .policy-main-heading {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #a7f3d0;
          margin: 0 0 0.25rem;
        }

        .policy-summary {
          font-size: 0.8125rem;
          color: #9ca3af;
          margin: 0;
          line-height: 1.4;
        }

        .toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #e5e7eb;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.4rem 0.75rem;
          border-radius: 0.5rem;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .toggle-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .policy-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1rem;
          padding: 0 1.25rem 1.25rem;
          border-top: 1px dashed rgba(16, 185, 129, 0.2);
          margin-top: 0.25rem;
          padding-top: 1rem;
        }

        .policy-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 0.75rem;
          padding: 1rem;
        }

        .card-badge {
          display: inline-block;
          font-size: 0.675rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          margin-bottom: 0.5rem;
        }

        .green-badge {
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
        }

        .blue-badge {
          background: rgba(59, 130, 246, 0.15);
          color: #93c5fd;
        }

        .yellow-badge {
          background: rgba(245, 158, 11, 0.15);
          color: #fcd34d;
        }

        .amber-badge {
          background: rgba(217, 119, 6, 0.15);
          color: #fbbf24;
        }

        .card-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0 0 0.4rem;
        }

        .card-body {
          font-size: 0.775rem;
          color: #9ca3af;
          line-height: 1.45;
          margin: 0;
        }

        @media (max-width: 640px) {
          .policy-main-bar {
            flex-direction: column;
            align-items: flex-start;
          }
          .toggle-btn {
            align-self: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
