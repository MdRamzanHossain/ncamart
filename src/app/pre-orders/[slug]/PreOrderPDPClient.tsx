"use client";

import React, { useState } from "react";
import { PreOrderItem, DepositBreakdown, calculateDepositBreakdown } from "@/components/preorder";
import { DepositCalculator } from "@/components/preorder/DepositCalculator";
import { useToast } from "@/components/ui/toast";

export interface PreOrderPDPClientProps {
  item: PreOrderItem;
  breakdown: DepositBreakdown;
}

export function PreOrderPDPClient({ item, breakdown: _initialBreakdown }: PreOrderPDPClientProps) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [depositPercent, setDepositPercent] = useState(item.deposit_percent);
  const [isReserving, setIsReserving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const currentTotal = item.total_price_paisa * quantity;
  const currentBreakdown = calculateDepositBreakdown(currentTotal, depositPercent);

  const handleOpenReserve = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmReservation = () => {
    setIsReserving(true);
    setTimeout(() => {
      setIsReserving(false);
      setShowConfirmModal(false);
      toast({
        title: "Pre-Order Slot Reserved!",
        description: `Your reservation of ${quantity}x ${item.brand_name} (${currentBreakdown.formattedDeposit} deposit) is locked for Batch ${item.batch_code}.`,
        variant: "success",
      });
    }, 1000);
  };

  return (
    <div className="client-action-wrapper">
      {/* Interactive Deposit Calculator */}
      <DepositCalculator
        totalPricePaisa={item.total_price_paisa}
        defaultDepositPercent={item.deposit_percent}
        availableTiers={[10, 15, 20]}
        initialQuantity={quantity}
        onQuantityChange={(q) => setQuantity(q)}
        onDepositPercentChange={(p) => setDepositPercent(p)}
      />

      {/* Main Reservation CTA Button */}
      <div className="cta-container">
        <button
          type="button"
          className="btn-reserve-main"
          onClick={handleOpenReserve}
        >
          <div className="cta-text-group">
            <span className="cta-main-label">
              Book Pre-Order Slot • Pay {currentBreakdown.formattedDeposit} Today
            </span>
            <span className="cta-sub-label">
              Balance {currentBreakdown.formattedRemaining} payable on arrival • 100% Refund SLA Guarantee
            </span>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <div className="security-assurances">
          <span className="assurance-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            SSLCommerz Secured
          </span>
          <span className="assurance-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            100% Money-Back SLA
          </span>
          <span className="assurance-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            COD Eligible Balance
          </span>
        </div>
      </div>

      {/* Modal for Pre-Order Confirmation */}
      {showConfirmModal && (
        <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
                </svg>
              </div>
              <div>
                <h3 className="modal-title">Confirm Pre-Order Reservation</h3>
                <p className="modal-subtitle">Batch {item.batch_code} • {item.origin_hub}</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowConfirmModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="item-summary-box">
                <div className="summary-item-title">{item.title_en}</div>
                <div className="summary-qty-tier">
                  Quantity: <strong>{quantity} units</strong> • Deposit: <strong>{depositPercent}%</strong>
                </div>
              </div>

              <div className="modal-breakdown-list">
                <div className="breakdown-item">
                  <span>Total Landed Price:</span>
                  <span>{currentBreakdown.formattedTotal}</span>
                </div>
                <div className="breakdown-item highlight-deposit">
                  <span>Advance Deposit Due Now:</span>
                  <span className="deposit-val">{currentBreakdown.formattedDeposit}</span>
                </div>
                <div className="breakdown-item">
                  <span>Balance Payable on Godown Arrival:</span>
                  <span>{currentBreakdown.formattedRemaining}</span>
                </div>
                <div className="breakdown-item">
                  <span>Estimated Arrival Window:</span>
                  <span className="eta-val">{item.estimated_arrival_window}</span>
                </div>
              </div>

              <div className="terms-checkbox-note">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>
                  Protected under NCAMart 100% money-back SLA guarantee if cargo delayed beyond ETA + 7 days.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-confirm"
                onClick={handleConfirmReservation}
                disabled={isReserving}
              >
                {isReserving ? "Processing..." : `Pay ${currentBreakdown.formattedDeposit} via SSLCommerz`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .client-action-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .cta-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .btn-reserve-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          width: 100%;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          padding: 1rem 1.5rem;
          border-radius: 0.875rem;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
        }

        .btn-reserve-main:hover {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.5);
        }

        .cta-text-group {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }

        .cta-main-label {
          font-size: 1.0625rem;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .cta-sub-label {
          font-size: 0.775rem;
          color: #bfdbfe;
          margin-top: 0.15rem;
        }

        .security-assurances {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem;
        }

        .assurance-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.725rem;
          color: #9ca3af;
        }

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
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-dialog {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 1.25rem;
          width: 100%;
          max-width: 520px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(30, 41, 59, 0.4);
        }

        .modal-icon {
          width: 40px;
          height: 40px;
          border-radius: 0.625rem;
          background: rgba(59, 130, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 0.75rem;
        }

        .modal-title {
          font-size: 1.125rem;
          font-weight: 700;
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
          font-size: 1.125rem;
          cursor: pointer;
        }

        .modal-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .item-summary-box {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 1rem;
        }

        .summary-item-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #f3f4f6;
          margin-bottom: 0.25rem;
        }

        .summary-qty-tier {
          font-size: 0.8125rem;
          color: #9ca3af;
        }

        .summary-qty-tier strong {
          color: #60a5fa;
        }

        .modal-breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          font-size: 0.875rem;
        }

        .breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #9ca3af;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
        }

        .highlight-deposit {
          color: #fbbf24;
          font-weight: 700;
        }

        .deposit-val {
          font-size: 1.125rem;
          font-weight: 800;
          color: #fbbf24;
        }

        .eta-val {
          color: #60a5fa;
          font-weight: 600;
        }

        .terms-checkbox-note {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          font-size: 0.775rem;
          color: #9ca3af;
          line-height: 1.4;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 0.625rem;
          padding: 0.75rem;
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

        .btn-modal-cancel {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #d1d5db;
          padding: 0.625rem 1.125rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-modal-confirm {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: #ffffff;
          padding: 0.625rem 1.25rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-modal-confirm:hover:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }

        .btn-modal-confirm:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
