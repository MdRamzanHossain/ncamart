"use client";

import React from "react";
import type { RunnerTask, RunnerProfile } from "./types";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";

interface GodownHandoverModalProps {
  isOpen: boolean;
  runner: RunnerProfile;
  purchasedTasks: RunnerTask[];
  onClose: () => void;
  onHandoverConfirmed: (batchId: string) => void;
}

export function GodownHandoverModal({
  isOpen,
  runner,
  purchasedTasks,
  onClose,
  onHandoverConfirmed,
}: GodownHandoverModalProps) {
  const { addToast } = useToast();

  if (!isOpen) return null;

  const totalSpentPaisa = purchasedTasks.reduce((sum, t) => {
    const price = t.negotiatedSpotPricePaisa || t.targetWholesalePricePaisa;
    return sum + price * t.quantity;
  }, 0);

  const totalUnits = purchasedTasks.reduce((sum, t) => sum + t.quantity, 0);
  const batchId = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`;

  const handleConfirm = () => {
    onHandoverConfirmed(batchId);
    addToast({
      title: "Batch Handed Over to Godown",
      description: `Batch ${batchId} received by Godown QC Inspector. Intake logged into physical inventory.`,
      variant: "success",
    });
    onClose();
  };

  return (
    <div className="handover-modal-backdrop" data-testid="godown-handover-modal">
      <div className="handover-modal-card">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="header-pill">Nawabpur Central Godown Intake</div>
            <h2 className="modal-title">Physical Batch Handover &amp; Float Sign-off</h2>
            <p className="modal-sub">
              Present this handover QR code to Godown QC Inspector to intake physical items.
            </p>
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Batch QR Code Display */}
        <div className="batch-qr-section">
          <div className="qr-box">
            <div className="qr-visual">
              <span className="qr-center-icon">📦</span>
            </div>
            <span className="qr-batch-code">{batchId}</span>
            <span className="qr-link-text">ncamart.com/qc/intake?batch={batchId}</span>
          </div>
          <span className="scan-prompt">Godown Inspector scans this QR to verify item counts &amp; float</span>
        </div>

        {/* Financial & Item Summary */}
        <div className="reconciliation-summary">
          <div className="summary-row">
            <span>Runner ID &amp; Name:</span>
            <strong>{runner.name} ({runner.id})</strong>
          </div>
          <div className="summary-row">
            <span>Physical SKUs in Bag:</span>
            <strong>{purchasedTasks.length} SKUs ({totalUnits} Units)</strong>
          </div>
          <div className="summary-row">
            <span>Total Spot Cash Spent:</span>
            <strong className="text-amber">{formatPaisa(totalSpentPaisa)}</strong>
          </div>
          <div className="summary-row float-balance-row">
            <span>Remaining Float in Hand:</span>
            <strong className="text-emerald">{formatPaisa(runner.cashFloatPaisa)}</strong>
          </div>
        </div>

        {/* Sourced Items List */}
        <div className="sourced-items-preview">
          <span className="preview-label">Items Ready for Inspection:</span>
          <div className="items-mini-list">
            {purchasedTasks.map((t) => (
              <div key={t.id} className="mini-item">
                <span className="mini-title">
                  {t.quantity}x {t.skuTitle}
                </span>
                <span className="mini-stall">{t.stallName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="modal-actions">
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-complete-handover"
            data-testid="confirm-godown-handover-btn"
          >
            <span>✓ Complete Godown Intake &amp; Release Tasks</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .handover-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .handover-modal-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          max-width: 440px;
          width: 100%;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          color: #f8fafc;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header-pill {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #a855f7;
          letter-spacing: 0.5px;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 800;
          margin: 4px 0 2px 0;
        }

        .modal-sub {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.4;
        }

        .close-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          border: none;
          cursor: pointer;
        }

        /* Batch QR */
        .batch-qr-section {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .qr-box {
          background: #ffffff;
          color: #000000;
          padding: 14px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }

        .qr-visual {
          width: 120px;
          height: 120px;
          background: #f1f5f9;
          border: 2px dashed #000;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qr-center-icon {
          font-size: 36px;
        }

        .qr-batch-code {
          font-family: monospace;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .qr-link-text {
          font-family: monospace;
          font-size: 9px;
          color: #475569;
        }

        .scan-prompt {
          font-size: 11px;
          color: #94a3b8;
          text-align: center;
        }

        /* Summary */
        .reconciliation-summary {
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          color: #cbd5e1;
        }

        .float-balance-row {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 6px;
          margin-top: 2px;
          font-size: 13px;
        }

        .text-amber {
          color: #f59e0b;
        }

        .text-emerald {
          color: #10b981;
        }

        /* Items Preview */
        .sourced-items-preview {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .preview-label {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
        }

        .items-mini-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 100px;
          overflow-y: auto;
        }

        .mini-item {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
        }

        .mini-title {
          color: #f8fafc;
        }

        .mini-stall {
          color: #94a3b8;
          font-family: monospace;
        }

        .btn-complete-handover {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(168, 85, 247, 0.35);
          transition: transform 0.15s ease;
        }

        .btn-complete-handover:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
