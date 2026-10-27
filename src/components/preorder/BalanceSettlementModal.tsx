"use client";

import React, { useState } from "react";
import { formatPaisa } from "@/lib/money";
import { PreOrderBalanceData } from "./PreOrderBalanceCard";
import { useToast } from "@/components/ui/toast";

export interface BalanceSettlementModalProps {
  orderData: PreOrderBalanceData;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BalanceSettlementModal({
  orderData,
  isOpen,
  onClose,
  onSuccess,
}: BalanceSettlementModalProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<"SSLCOMMERZ" | "COD" | "COUNTER">("SSLCOMMERZ");
  const [applyStoreCredit, setApplyStoreCredit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // PRD §3.4.2: COD allowed for balance payment only if balance <= ৳5,000 (500,000 paisa)
  const COD_BALANCE_CAP_PAISA = 500000; // ৳5,000
  const isCodAllowed = orderData.balanceDuePaisa <= COD_BALANCE_CAP_PAISA && orderData.isCodEligible;

  // Store credit calculation
  const storeCreditAvailable = orderData.storeCreditBalancePaisa || 0;
  const storeCreditDeduction = applyStoreCredit
    ? Math.min(storeCreditAvailable, orderData.balanceDuePaisa)
    : 0;
  const netPayablePaisa = Math.max(0, orderData.balanceDuePaisa - storeCreditDeduction);

  const handlePayBalance = () => {
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Balance Settled Successfully!",
        description: `Order #${orderData.orderNumber} transitioned to PACKED status. Official Mushak 6.3 Tax Invoice generated.`,
        variant: "success",
      });
      onSuccess();
    }, 1200);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-left">
            <div className="header-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div>
              <h3 className="modal-title">Settle Pre-Order Arrival Balance</h3>
              <p className="modal-subtitle">Order #{orderData.orderNumber} • QC Passed & Sealed</p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Order Summary Line */}
          <div className="summary-pill">
            <span className="summary-title">{orderData.itemTitle}</span>
            <span className="summary-seal">Seal: {orderData.sealId}</span>
          </div>

          {/* Store Credit Deduction Toggle */}
          {storeCreditAvailable > 0 && (
            <div className="store-credit-box">
              <label className="credit-label">
                <input
                  type="checkbox"
                  checked={applyStoreCredit}
                  onChange={(e) => setApplyStoreCredit(e.target.checked)}
                  className="checkbox-input"
                />
                <div>
                  <span className="credit-text">
                    Apply Store Credit Balance ({formatPaisa(storeCreditAvailable)} available)
                  </span>
                  <span className="credit-sub">Deducts {formatPaisa(storeCreditDeduction)} from remaining balance</span>
                </div>
              </label>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="methods-group">
            <span className="section-label">Select Balance Payment Method:</span>

            {/* Option A: SSLCommerz */}
            <div
              className={`method-option ${selectedMethod === "SSLCOMMERZ" ? "selected" : ""}`}
              onClick={() => setSelectedMethod("SSLCOMMERZ")}
            >
              <div className="radio-dot" />
              <div className="method-info">
                <div className="method-title-row">
                  <span className="method-title">Instant Online Payment (bKash / Nagad / Cards)</span>
                  <span className="badge-fast">Fastest Dispatch</span>
                </div>
                <p className="method-desc">
                  Instant settlement via SSLCommerz gateway. Unit queued for same-day courier dispatch.
                </p>
              </div>
            </div>

            {/* Option B: Cash on Delivery (COD) */}
            <div
              className={`method-option ${selectedMethod === "COD" ? "selected" : ""} ${!isCodAllowed ? "disabled-option" : ""}`}
              onClick={() => isCodAllowed && setSelectedMethod("COD")}
            >
              <div className="radio-dot" />
              <div className="method-info">
                <div className="method-title-row">
                  <span className="method-title">Cash on Delivery (Doorstep Courier)</span>
                  {!isCodAllowed && (
                    <span className="badge-locked">
                      {orderData.balanceDuePaisa > COD_BALANCE_CAP_PAISA
                        ? `Capped at ${formatPaisa(COD_BALANCE_CAP_PAISA)}`
                        : "Account Blocked"}
                    </span>
                  )}
                </div>
                <p className="method-desc">
                  {isCodAllowed
                    ? "Pay balance in cash upon courier parcel handover at your doorstep."
                    : `Pre-order balance (${formatPaisa(orderData.balanceDuePaisa)}) exceeds the ${formatPaisa(COD_BALANCE_CAP_PAISA)} COD limit per PRD §3.4.2. Online or counter payment required.`}
                </p>
              </div>
            </div>

            {/* Option C: Showroom Counter Handover */}
            <div
              className={`method-option ${selectedMethod === "COUNTER" ? "selected" : ""}`}
              onClick={() => setSelectedMethod("COUNTER")}
            >
              <div className="radio-dot" />
              <div className="method-info">
                <div className="method-title-row">
                  <span className="method-title">Pay at Nawabpur Showroom Counter</span>
                  <span className="badge-pin">Pickup PIN: {orderData.showroomPin || "PIN-8924"}</span>
                </div>
                <p className="method-desc">
                  Inspect item on test bench and pay balance via cash/card at Nawabpur Complex Showroom.
                </p>
              </div>
            </div>
          </div>

          {/* Amount Due Summary */}
          <div className="payable-summary-box">
            <div className="payable-row">
              <span>Original Remaining Balance:</span>
              <span>{formatPaisa(orderData.balanceDuePaisa)}</span>
            </div>
            {storeCreditDeduction > 0 && (
              <div className="payable-row credit-deduct-row">
                <span>Store Credit Applied:</span>
                <span>− {formatPaisa(storeCreditDeduction)}</span>
              </div>
            )}
            <div className="payable-row net-row">
              <span className="net-label">Net Payable Today:</span>
              <span className="net-amount">{formatPaisa(netPayablePaisa)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-confirm-pay"
            onClick={handlePayBalance}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span>Confirming Settlement...</span>
            ) : (
              <span>Confirm & Settle {formatPaisa(netPayablePaisa)}</span>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 1000;
        }

        .modal-dialog {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 1.25rem;
          width: 100%;
          max-width: 550px;
          overflow: hidden;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.6);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          background: rgba(30, 41, 59, 0.4);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-icon {
          width: 40px;
          height: 40px;
          border-radius: 0.625rem;
          background: rgba(59, 130, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-title {
          font-size: 1.0625rem;
          font-weight: 800;
          color: #f3f4f6;
          margin: 0;
        }

        .modal-subtitle {
          font-size: 0.75rem;
          color: #9ca3af;
          margin: 0.15rem 0 0;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 1.25rem;
          cursor: pointer;
        }

        .modal-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .summary-pill {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.625rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.8125rem;
        }

        .summary-title {
          font-weight: 600;
          color: #e5e7eb;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
        }

        .summary-seal {
          font-family: var(--font-mono, monospace);
          color: #60a5fa;
          font-size: 0.75rem;
        }

        .store-credit-box {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 0.625rem;
          padding: 0.75rem 1rem;
        }

        .credit-label {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          cursor: pointer;
        }

        .checkbox-input {
          margin-top: 0.2rem;
          width: 16px;
          height: 16px;
          accent-color: #10b981;
        }

        .credit-text {
          font-size: 0.84rem;
          font-weight: 700;
          color: #a7f3d0;
          display: block;
        }

        .credit-sub {
          font-size: 0.725rem;
          color: #9ca3af;
          display: block;
        }

        .methods-group {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .section-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #9ca3af;
        }

        .method-option {
          display: flex;
          align-items: flex-start;
          gap: 0.875rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          padding: 0.875rem 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .method-option:hover:not(.disabled-option) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .method-option.selected {
          background: rgba(59, 130, 246, 0.12);
          border-color: #3b82f6;
        }

        .disabled-option {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .radio-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          margin-top: 0.15rem;
          flex-shrink: 0;
          position: relative;
        }

        .method-option.selected .radio-dot {
          border-color: #3b82f6;
          background: #3b82f6;
        }

        .method-info {
          flex: 1;
        }

        .method-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.2rem;
        }

        .method-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #f3f4f6;
        }

        .badge-fast {
          font-size: 0.675rem;
          font-weight: 700;
          color: #6ee7b7;
          background: rgba(16, 185, 129, 0.15);
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
        }

        .badge-locked {
          font-size: 0.675rem;
          font-weight: 700;
          color: #f87171;
          background: rgba(239, 68, 68, 0.15);
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
        }

        .badge-pin {
          font-size: 0.675rem;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.15);
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-family: var(--font-mono, monospace);
        }

        .method-desc {
          font-size: 0.775rem;
          color: #9ca3af;
          margin: 0;
          line-height: 1.35;
        }

        .payable-summary-box {
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 0.875rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-size: 0.84rem;
        }

        .payable-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #9ca3af;
        }

        .credit-deduct-row {
          color: #6ee7b7;
        }

        .net-row {
          border-top: 1px dashed rgba(255, 255, 255, 0.1);
          padding-top: 0.4rem;
          margin-top: 0.2rem;
        }

        .net-label {
          font-size: 0.9375rem;
          font-weight: 800;
          color: #f3f4f6;
        }

        .net-amount {
          font-size: 1.25rem;
          font-weight: 800;
          color: #fbbf24;
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          background: rgba(30, 41, 59, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .btn-cancel {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #d1d5db;
          padding: 0.625rem 1.125rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-confirm-pay {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: #ffffff;
          padding: 0.625rem 1.35rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-confirm-pay:hover:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }

        .btn-confirm-pay:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
