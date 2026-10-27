"use client";

import React, { useState } from "react";
import { calculateDepositBreakdown } from "./types";

export interface DepositCalculatorProps {
  totalPricePaisa: number;
  defaultDepositPercent?: number; // 10, 15, or 20
  availableTiers?: number[];
  initialQuantity?: number;
  onQuantityChange?: (qty: number) => void;
  onDepositPercentChange?: (percent: number) => void;
}

export function DepositCalculator({
  totalPricePaisa,
  defaultDepositPercent = 15,
  availableTiers = [10, 15, 20],
  initialQuantity = 1,
  onQuantityChange,
  onDepositPercentChange,
}: DepositCalculatorProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [selectedPercent, setSelectedPercent] = useState(defaultDepositPercent);

  const currentTotalPrice = totalPricePaisa * quantity;
  const breakdown = calculateDepositBreakdown(currentTotalPrice, selectedPercent);

  const handleQtyChange = (newQty: number) => {
    if (newQty < 1 || newQty > 5) return;
    setQuantity(newQty);
    if (onQuantityChange) onQuantityChange(newQty);
  };

  const handlePercentChange = (pct: number) => {
    setSelectedPercent(pct);
    if (onDepositPercentChange) onDepositPercentChange(pct);
  };

  return (
    <div className="deposit-calc-card">
      <div className="calc-header">
        <div className="calc-title-group">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <path d="M12 14v4M10 16h4" />
          </svg>
          <h3 className="calc-title">Progressive Deposit Calculator</h3>
        </div>
        <span className="calc-badge">Integer Paisa Precision</span>
      </div>

      {/* Controls: Quantity & Deposit Tier */}
      <div className="calc-controls-row">
        {/* Quantity Stepper */}
        <div className="control-item">
          <label className="control-label">Reserved Units:</label>
          <div className="stepper-wrap">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => handleQtyChange(quantity - 1)}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              -
            </button>
            <span className="stepper-value">{quantity}</span>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => handleQtyChange(quantity + 1)}
              disabled={quantity >= 5}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        {/* Deposit Tier Selector */}
        <div className="control-item">
          <label className="control-label">Advance Tier:</label>
          <div className="tier-pills">
            {availableTiers.map((tier) => (
              <button
                key={tier}
                type="button"
                className={`tier-pill ${selectedPercent === tier ? "active" : ""}`}
                onClick={() => handlePercentChange(tier)}
              >
                {tier}% Advance
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Visual Ratio Bar */}
      <div className="ratio-bar-wrap">
        <div className="ratio-track">
          <div
            className="ratio-fill-deposit"
            style={{ width: `${selectedPercent}%` }}
            title={`Advance Deposit: ${selectedPercent}%`}
          />
          <div
            className="ratio-fill-remaining"
            style={{ width: `${100 - selectedPercent}%` }}
            title={`Remaining on Arrival: ${100 - selectedPercent}%`}
          />
        </div>
        <div className="ratio-labels">
          <span className="ratio-label-deposit">
            <span className="color-dot dot-deposit" /> Paid Today ({selectedPercent}%)
          </span>
          <span className="ratio-label-remaining">
            <span className="color-dot dot-remaining" /> Balance on Arrival ({100 - selectedPercent}%)
          </span>
        </div>
      </div>

      {/* Itemized Calculation Summary Box */}
      <div className="summary-table">
        <div className="summary-row">
          <span className="summary-label">Total Item Price ({quantity} {quantity > 1 ? "units" : "unit"}):</span>
          <span className="summary-value-total">{breakdown.formattedTotal}</span>
        </div>
        <div className="summary-row highlight-row">
          <span className="summary-label">
            <strong>Advance Deposit to Reserve ({selectedPercent}%):</strong>
          </span>
          <span className="summary-value-deposit">{breakdown.formattedDeposit}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Remaining Balance Payable on Arrival:</span>
          <span className="summary-value-remaining">{breakdown.formattedRemaining}</span>
        </div>
      </div>

      <div className="calc-footnote">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>
          Includes all international air-freight, import customs clearance, and BTRC approval duties. No surprise charges upon arrival.
        </span>
      </div>

      <style jsx>{`
        .deposit-calc-card {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 1rem;
          padding: 1.25rem;
          backdrop-filter: blur(10px);
        }

        .calc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
        }

        .calc-title-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .calc-title {
          font-size: 1rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0;
        }

        .calc-badge {
          font-size: 0.7rem;
          color: #93c5fd;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.25);
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }

        .calc-controls-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: rgba(0, 0, 0, 0.25);
          padding: 0.875rem 1rem;
          border-radius: 0.75rem;
          margin-bottom: 1.25rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .control-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .control-label {
          font-size: 0.8125rem;
          color: #9ca3af;
          font-weight: 500;
        }

        .stepper-wrap {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stepper-btn {
          width: 30px;
          height: 30px;
          background: transparent;
          border: none;
          color: #f3f4f6;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .stepper-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }

        .stepper-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .stepper-value {
          padding: 0 0.75rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: #ffffff;
        }

        .tier-pills {
          display: flex;
          gap: 0.375rem;
        }

        .tier-pill {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #9ca3af;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.3rem 0.6rem;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tier-pill:hover {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.25);
        }

        .tier-pill.active {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.5);
          color: #fbbf24;
        }

        .ratio-bar-wrap {
          margin-bottom: 1.25rem;
        }

        .ratio-track {
          display: flex;
          height: 10px;
          width: 100%;
          border-radius: 9999px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.05);
        }

        .ratio-fill-deposit {
          background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
          transition: width 0.3s ease;
        }

        .ratio-fill-remaining {
          background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
          transition: width 0.3s ease;
        }

        .ratio-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          margin-top: 0.5rem;
        }

        .color-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 0.3rem;
        }

        .dot-deposit {
          background: #fbbf24;
        }

        .dot-remaining {
          background: #60a5fa;
        }

        .ratio-label-deposit {
          color: #fcd34d;
        }

        .ratio-label-remaining {
          color: #93c5fd;
        }

        .summary-table {
          background: rgba(0, 0, 0, 0.35);
          border-radius: 0.75rem;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 1rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.4rem 0;
          font-size: 0.875rem;
        }

        .summary-row:not(:last-child) {
          border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
        }

        .summary-label {
          color: #9ca3af;
        }

        .summary-value-total {
          font-weight: 700;
          color: #f3f4f6;
        }

        .highlight-row {
          padding: 0.6rem 0;
        }

        .highlight-row .summary-label {
          color: #fbbf24;
        }

        .summary-value-deposit {
          font-size: 1.25rem;
          font-weight: 800;
          color: #fbbf24;
        }

        .summary-value-remaining {
          font-weight: 700;
          color: #60a5fa;
        }

        .calc-footnote {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: #9ca3af;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
