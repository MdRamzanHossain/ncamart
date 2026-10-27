"use client";

import React, { useState } from "react";
import type { RunnerTask } from "./types";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";
import { VoucherCameraModal } from "./VoucherCameraModal";

interface RunnerTaskCardProps {
  task: RunnerTask;
  onUpdateStatus: (taskId: string, nextStatus: RunnerTask["status"], negotiatedPricePaisa?: number) => void;
  onRequestOverride: (taskId: string, spotPricePaisa: number) => void;
  onApproveOverrideSimulated: (taskId: string) => void;
  onAttachVoucher?: (taskId: string, voucherDataUrl: string) => void;
}

export function RunnerTaskCard({
  task,
  onUpdateStatus,
  onRequestOverride,
  onApproveOverrideSimulated,
  onAttachVoucher,
}: RunnerTaskCardProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [voucherUrl, setVoucherUrl] = useState<string | null>(task.purchasedReceiptUrl || null);
  const [spotPriceInput, setSpotPriceInput] = useState<string>(
    task.negotiatedSpotPricePaisa
      ? (task.negotiatedSpotPricePaisa / 100).toString()
      : (task.targetWholesalePricePaisa / 100).toString()
  );

  const { addToast } = useToast();

  const enteredSpotPaisa = Math.round((parseFloat(spotPriceInput) || 0) * 100);
  const isOverThreshold = enteredSpotPaisa > task.maxAllowedSpotPricePaisa;

  const handleAdvanceStatus = () => {
    if (task.status === "ASSIGNED") {
      onUpdateStatus(task.id, "ACCEPTED");
      addToast({
        title: "Task Accepted",
        description: `Head to ${task.marketName} — ${task.stallName}.`,
        variant: "info",
      });
    } else if (task.status === "ACCEPTED") {
      onUpdateStatus(task.id, "AT_STALL");
      addToast({
        title: "Arrived at Stall",
        description: `Check physical inventory and negotiate spot price with ${task.stallName}.`,
        variant: "info",
      });
    } else if (task.status === "AT_STALL") {
      if (isOverThreshold) {
        addToast({
          title: "Supervisor Override Required",
          description: `Price ৳${(enteredSpotPaisa / 100).toFixed(0)} exceeds max limit ৳${(task.maxAllowedSpotPricePaisa / 100).toFixed(0)}. Request override before purchasing.`,
          variant: "error",
        });
        return;
      }
      onUpdateStatus(task.id, "PURCHASED", enteredSpotPaisa);
      addToast({
        title: "Purchase Recorded",
        description: `Paid ${formatPaisa(enteredSpotPaisa * task.quantity)} from cash float. Return items to Godown.`,
        variant: "success",
      });
    } else if (task.status === "PURCHASED") {
      onUpdateStatus(task.id, "RETURNED_GODOWN");
      addToast({
        title: "Handed over to Godown",
        description: `Staged for QC inspection and holographic seal minting.`,
        variant: "success",
      });
    }
  };

  const handleRequestOverride = () => {
    onRequestOverride(task.id, enteredSpotPaisa);
    addToast({
      title: "Override Request Sent",
      description: `Dispatched Class A Sourcing Manager alert for spot price ${formatPaisa(enteredSpotPaisa)}.`,
      variant: "info",
    });
  };

  return (
    <article className="runner-task-card" data-testid={`runner-task-card-${task.id}`}>
      {/* Top Header: Task Reference & Status */}
      <div className="card-header">
        <div className="task-id-col">
          <span className="task-ref">{task.id}</span>
          <span className="order-tag">Order: {task.orderNumber}</span>
        </div>

        <div className="status-pill-wrap">
          {task.status === "ASSIGNED" && <span className="pill pill-assigned">Assigned</span>}
          {task.status === "ACCEPTED" && <span className="pill pill-accepted">En Route to Stall</span>}
          {task.status === "AT_STALL" && <span className="pill pill-at-stall">At Wholesale Stall</span>}
          {task.status === "PRICE_OVERRIDE_PENDING" && (
            <span className="pill pill-override">⚠️ Override Pending</span>
          )}
          {task.status === "PURCHASED" && <span className="pill pill-purchased">Purchased (In Bag)</span>}
          {task.status === "RETURNED_GODOWN" && (
            <span className="pill pill-godown">✓ Returned to Godown</span>
          )}
        </div>
      </div>

      {/* Wholesale Stall & Location (Zero Customer PII per PRD §3.8) */}
      <div className="stall-location-box">
        <div className="stall-icon">🏬</div>
        <div className="stall-details">
          <h3 className="stall-name">{task.stallName}</h3>
          <p className="market-name">
            {task.marketName} • Stall #{task.stallNumber}
          </p>
          <a href={`tel:${task.stallContactPhone}`} className="stall-phone-link">
            📞 Call Merchant: {task.stallContactPhone}
          </a>
        </div>
      </div>

      {/* SKU Item Details */}
      <div className="sku-item-row">
        <div className="sku-thumb-wrap">
          <img src={task.image} alt={task.skuTitle} className="sku-thumb" />
        </div>
        <div className="sku-info">
          <span className="sku-code">{task.skuCode}</span>
          <h4 className="sku-title">{task.skuTitle}</h4>
          <div className="qty-tag">
            Required Quantity: <strong>{task.quantity} Units</strong>
          </div>
        </div>
      </div>

      {/* Wholesale Pricing & Negotiation Panel */}
      <div className="pricing-benchmark-box">
        <div className="benchmark-row">
          <div className="bench-col">
            <span className="bench-label">Target Wholesale</span>
            <span className="bench-val target">{formatPaisa(task.targetWholesalePricePaisa)}</span>
          </div>
          <div className="bench-col">
            <span className="bench-label">Max Allowed Spot Limit</span>
            <span className="bench-val limit">{formatPaisa(task.maxAllowedSpotPricePaisa)}</span>
          </div>
        </div>

        {/* Spot Price Input when at Stall */}
        {(task.status === "AT_STALL" || task.status === "PRICE_OVERRIDE_PENDING") && (
          <div className="spot-input-section">
            <label className="spot-label">Negotiated Spot Price Per Unit (৳):</label>
            <div className="input-group">
              <span className="currency-symbol">৳</span>
              <input
                type="number"
                value={spotPriceInput}
                onChange={(e) => setSpotPriceInput(e.target.value)}
                disabled={task.status === "PRICE_OVERRIDE_PENDING"}
                className={`spot-price-input ${isOverThreshold ? "input-danger" : ""}`}
                placeholder="Enter spot price..."
                data-testid="spot-price-input"
              />
            </div>

            {/* Threshold Warning Banner */}
            {isOverThreshold && task.status === "AT_STALL" && (
              <div className="threshold-alert" data-testid="override-warning-banner">
                <span className="alert-icon">⚠️</span>
                <div className="alert-text">
                  <strong>Supervisor Sourcing Override Required</strong>
                  <p>
                    Negotiated spot price ({formatPaisa(enteredSpotPaisa)}) exceeds the 15% wholesale margin safety threshold ({formatPaisa(task.maxAllowedSpotPricePaisa)}). Direct purchase is blocked.
                  </p>
                </div>
              </div>
            )}

            {/* Pending Sourcing Manager Review */}
            {task.status === "PRICE_OVERRIDE_PENDING" && (
              <div className="pending-override-box" data-testid="override-pending-banner">
                <div className="pulse-spinner" />
                <div className="pending-text">
                  <strong>Awaiting Sourcing Manager Decision</strong>
                  <p>Request sent via realtime WebSocket. Do not leave stall.</p>
                </div>
                <button
                  type="button"
                  onClick={() => onApproveOverrideSimulated(task.id)}
                  className="simulate-approve-btn"
                  title="Simulate Manager Approval for Testing"
                >
                  ⚡ Simulate Sourcing Approval
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Stepper Button */}
      <div className="card-actions">
        {task.status === "ASSIGNED" && (
          <button type="button" onClick={handleAdvanceStatus} className="btn-action btn-primary">
            <span>🚀 Accept Task &amp; Begin Route</span>
          </button>
        )}

        {task.status === "ACCEPTED" && (
          <button type="button" onClick={handleAdvanceStatus} className="btn-action btn-stall">
            <span>📍 Confirmed: Arrived at Wholesale Stall</span>
          </button>
        )}

        {task.status === "AT_STALL" && (
          <>
            {isOverThreshold ? (
              <button
                type="button"
                onClick={handleRequestOverride}
                className="btn-action btn-override"
                data-testid="request-override-btn"
              >
                <span>📡 Request Supervisor Override</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAdvanceStatus}
                className="btn-action btn-purchase"
                data-testid="record-purchase-btn"
              >
                <span>💰 Record Purchase ({formatPaisa(enteredSpotPaisa * task.quantity)})</span>
              </button>
            )}
          </>
        )}

        {/* Stall Memo Voucher Scanner Button */}
        {(task.status === "AT_STALL" || task.status === "PURCHASED") && (
          <div style={{ marginTop: "6px" }}>
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                background: voucherUrl ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.06)",
                border: voucherUrl ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(255, 255, 255, 0.12)",
                color: voucherUrl ? "#34d399" : "#cbd5e1",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
              data-testid="voucher-camera-trigger"
            >
              <span>📷</span>
              <span>{voucherUrl ? "✓ Stall Cash Memo Attached (Tap to View/Retake)" : "Scan Wholesale Stall Memo Receipt"}</span>
            </button>
          </div>
        )}

        {task.status === "PURCHASED" && (
          <button type="button" onClick={handleAdvanceStatus} className="btn-action btn-godown">
            <span>📦 Return Batch to Nawabpur Godown QC</span>
          </button>
        )}

        {task.status === "RETURNED_GODOWN" && (
          <div className="returned-notice">
            <span>✓ Unit physically received at Godown QC Lab (Waiting for Holographic Seal)</span>
          </div>
        )}
      </div>

      {/* Wholesale Stall Memo Camera Modal */}
      <VoucherCameraModal
        isOpen={isCameraOpen}
        taskId={task.id}
        stallName={task.stallName}
        onClose={() => setIsCameraOpen(false)}
        onVoucherCaptured={(tid, dataUrl) => {
          setVoucherUrl(dataUrl);
          if (onAttachVoucher) {
            onAttachVoucher(tid, dataUrl);
          }
        }}
      />

      <style jsx>{`
        .runner-task-card {
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          color: #f8fafc;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .task-id-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .task-ref {
          font-size: 13px;
          font-weight: 800;
          color: #f59e0b;
          font-family: monospace;
        }

        .order-tag {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        .pill {
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .pill-assigned {
          background: rgba(148, 163, 184, 0.15);
          color: #cbd5e1;
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        .pill-accepted {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .pill-at-stall {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .pill-override {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .pill-purchased {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .pill-godown {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
          border: 1px solid rgba(168, 85, 247, 0.3);
        }

        /* Stall Box */
        .stall-location-box {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stall-icon {
          font-size: 24px;
        }

        .stall-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stall-name {
          font-size: 13px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0;
        }

        .market-name {
          font-size: 11px;
          color: #94a3b8;
          margin: 0;
        }

        .stall-phone-link {
          font-size: 11px;
          color: #38bdf8;
          text-decoration: none;
          font-weight: 600;
          margin-top: 2px;
        }

        /* SKU details */
        .sku-item-row {
          display: flex;
          gap: 12px;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
          padding: 8px;
        }

        .sku-thumb-wrap {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          overflow: hidden;
          background: #0f172a;
          flex-shrink: 0;
        }

        .sku-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .sku-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sku-code {
          font-size: 10px;
          color: #94a3b8;
          font-family: monospace;
        }

        .sku-title {
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
          line-height: 1.3;
        }

        .qty-tag {
          font-size: 11px;
          color: #f59e0b;
        }

        /* Benchmark box */
        .pricing-benchmark-box {
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .benchmark-row {
          display: flex;
          justify-content: space-between;
        }

        .bench-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .bench-label {
          font-size: 10px;
          color: #94a3b8;
          font-weight: 600;
        }

        .bench-val {
          font-size: 13px;
          font-weight: 800;
        }

        .bench-val.target {
          color: #10b981;
        }

        .bench-val.limit {
          color: #38bdf8;
        }

        /* Spot Input */
        .spot-input-section {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .spot-label {
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
        }

        .currency-symbol {
          position: absolute;
          left: 10px;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 800;
        }

        .spot-price-input {
          width: 100%;
          padding: 8px 10px 8px 26px;
          background: #000;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
        }

        .input-danger {
          border-color: #ef4444;
          color: #ef4444;
        }

        .threshold-alert {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          gap: 8px;
          font-size: 11px;
          color: #fca5a5;
          line-height: 1.4;
        }

        .threshold-alert strong {
          color: #ef4444;
          display: block;
          margin-bottom: 2px;
        }

        .threshold-alert p {
          margin: 0;
        }

        .pending-override-box {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: 8px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11px;
        }

        .pending-text strong {
          color: #f59e0b;
        }

        .pending-text p {
          margin: 2px 0 0 0;
          color: #cbd5e1;
        }

        .simulate-approve-btn {
          align-self: flex-start;
          padding: 4px 8px;
          border-radius: 4px;
          background: #f59e0b;
          color: #0f172a;
          font-size: 10px;
          font-weight: 800;
          border: none;
          cursor: pointer;
        }

        /* Actions */
        .card-actions {
          margin-top: 2px;
        }

        .btn-action {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: #3b82f6;
          color: #fff;
        }

        .btn-stall {
          background: #f59e0b;
          color: #0f172a;
        }

        .btn-purchase {
          background: #10b981;
          color: #fff;
        }

        .btn-override {
          background: #ef4444;
          color: #fff;
        }

        .btn-godown {
          background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);
          color: #fff;
        }

        .returned-notice {
          padding: 8px;
          border-radius: 6px;
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.25);
          color: #c084fc;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
        }
      `}</style>
    </article>
  );
}
