"use client";

import React from "react";
import Link from "next/link";
import { formatPaisa } from "@/lib/money";

export interface PreOrderBalanceData {
  orderNumber: string;
  itemTitle: string;
  brandName: string;
  skuCode: string;
  sealId: string;
  qcPassedAt: string;
  totalPricePaisa: number;
  depositPaidPaisa: number;
  balanceDuePaisa: number;
  orderStatus: "ARRIVED_GODOWN" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED";
  customerName: string;
  customerPhone: string;
  showroomPin?: string;
  isCodEligible: boolean;
  storeCreditBalancePaisa: number;
}

export interface PreOrderBalanceCardProps {
  orderData: PreOrderBalanceData;
  onOpenPayModal: () => void;
}

export function PreOrderBalanceCard({
  orderData,
  onOpenPayModal,
}: PreOrderBalanceCardProps) {
  const isSettled = orderData.orderStatus !== "ARRIVED_GODOWN";

  return (
    <div className="balance-alert-card">
      {/* Top Godown QC Passed Badge */}
      <div className="qc-status-header">
        <div className="qc-stamp">
          <div className="qc-checkmark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 className="qc-status-title">
              {isSettled ? "Order State: PACKED & Awaiting Dispatch" : "Arrived at Nawabpur Godown — QC Passed & Sealed"}
            </h3>
            <p className="qc-status-sub">
              Verified by QC Technician • Destructive Hologram Applied on {orderData.qcPassedAt}
            </p>
          </div>
        </div>

        {/* Hologram Seal Link */}
        <div className="seal-link-box">
          <span className="seal-label">Destructive Tamper Seal ID:</span>
          <Link
            href={`/verify?seal=${encodeURIComponent(orderData.sealId)}`}
            className="seal-pill"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="holo-dot" />
            <span className="seal-code">{orderData.sealId}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Main Order & Product Details Grid */}
      <div className="card-main-content">
        <div className="product-summary-block">
          <div className="sku-meta-line">
            <span className="brand-tag">{orderData.brandName}</span>
            <span className="sku-tag">{orderData.skuCode}</span>
            <span className="order-num-tag">Order #{orderData.orderNumber}</span>
          </div>

          <h4 className="product-name">{orderData.itemTitle}</h4>

          <div className="inspection-highlights">
            <div className="highlight-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <span>Oscilloscope Bench Test Passed</span>
            </div>
            <div className="highlight-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>100% Authentic Import Cleared</span>
            </div>
          </div>
        </div>

        {/* Financial Breakdown Card */}
        <div className="financial-ledger-box">
          <h5 className="ledger-heading">Pre-Order Settlement Ledger</h5>

          <div className="ledger-table">
            <div className="ledger-row">
              <span className="ledger-label">Total Landed Price:</span>
              <span className="ledger-val-total">{formatPaisa(orderData.totalPricePaisa)}</span>
            </div>
            <div className="ledger-row deposit-row">
              <span className="ledger-label">
                <span className="check-bullet">✓</span> Advance Deposit Already Paid:
              </span>
              <span className="ledger-val-deposit">− {formatPaisa(orderData.depositPaidPaisa)}</span>
            </div>
            <div className="ledger-divider" />
            <div className="ledger-row due-row">
              <span className="ledger-label-due">Remaining Balance Payable:</span>
              <span className="ledger-val-due">{formatPaisa(orderData.balanceDuePaisa)}</span>
            </div>
          </div>

          {!isSettled ? (
            <button
              type="button"
              className="btn-settle-balance"
              onClick={onOpenPayModal}
            >
              <span>Settle Balance ({formatPaisa(orderData.balanceDuePaisa)})</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <div className="settled-status-notice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Balance Fully Settled • Parcel In Packing Station</span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .balance-alert-card {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.25rem;
          overflow: hidden;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
        }

        .qc-status-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          background: linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%);
          border-bottom: 1px solid rgba(16, 185, 129, 0.25);
        }

        .qc-stamp {
          display: flex;
          align-items: center;
          gap: 0.875rem;
        }

        .qc-checkmark {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.2);
          border: 1.5px solid #10b981;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .qc-status-title {
          font-size: 1.0625rem;
          font-weight: 800;
          color: #6ee7b7;
          margin: 0 0 0.15rem;
          letter-spacing: -0.01em;
        }

        .qc-status-sub {
          font-size: 0.775rem;
          color: #9ca3af;
          margin: 0;
        }

        .seal-link-box {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }

        .seal-label {
          font-size: 0.7rem;
          color: #9ca3af;
        }

        .seal-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #93c5fd;
          font-size: 0.8125rem;
          font-weight: 700;
          font-family: var(--font-mono, monospace);
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .seal-pill:hover {
          border-color: #60a5fa;
          background: rgba(59, 130, 246, 0.15);
          color: #ffffff;
        }

        .holo-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f43f5e 0%, #3b82f6 50%, #10b981 100%);
        }

        .card-main-content {
          padding: 1.5rem;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 2rem;
        }

        .sku-meta-line {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .brand-tag {
          font-size: 0.75rem;
          font-weight: 700;
          color: #60a5fa;
        }

        .sku-tag {
          font-size: 0.725rem;
          font-family: var(--font-mono, monospace);
          color: #9ca3af;
        }

        .order-num-tag {
          font-size: 0.725rem;
          background: rgba(255, 255, 255, 0.08);
          color: #e5e7eb;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
        }

        .product-name {
          font-size: 1.25rem;
          font-weight: 800;
          line-height: 1.4;
          color: #f3f4f6;
          margin: 0 0 1rem;
        }

        .inspection-highlights {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .highlight-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 0.4rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          color: #d1d5db;
        }

        .financial-ledger-box {
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .ledger-heading {
          font-size: 0.875rem;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ledger-table {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          margin-bottom: 1.25rem;
        }

        .ledger-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
        }

        .ledger-label {
          color: #9ca3af;
        }

        .ledger-val-total {
          font-weight: 700;
          color: #f3f4f6;
        }

        .deposit-row .ledger-label {
          color: #6ee7b7;
        }

        .check-bullet {
          font-weight: 800;
          margin-right: 0.2rem;
        }

        .ledger-val-deposit {
          font-weight: 700;
          color: #6ee7b7;
        }

        .ledger-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 0.25rem 0;
        }

        .due-row {
          padding-top: 0.25rem;
        }

        .ledger-label-due {
          font-size: 0.9375rem;
          font-weight: 800;
          color: #fbbf24;
        }

        .ledger-val-due {
          font-size: 1.35rem;
          font-weight: 800;
          color: #fbbf24;
        }

        .btn-settle-balance {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: none;
          color: #ffffff;
          padding: 0.875rem 1.25rem;
          border-radius: 0.75rem;
          font-size: 0.9375rem;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.2s ease;
          box-shadow: 0 6px 18px rgba(245, 158, 11, 0.35);
        }

        .btn-settle-balance:hover {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(245, 158, 11, 0.45);
        }

        .settled-status-notice {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
          font-size: 0.84rem;
          font-weight: 700;
          padding: 0.75rem;
          border-radius: 0.625rem;
        }

        @media (max-width: 768px) {
          .card-main-content {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
          .seal-link-box {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
