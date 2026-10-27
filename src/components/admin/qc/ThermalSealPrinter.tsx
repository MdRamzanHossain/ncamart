"use client";

import React from "react";
import type { QcInspectionItem } from "./types";
import { useToast } from "@/components/ui/toast";

interface ThermalSealPrinterProps {
  isOpen: boolean;
  item: QcInspectionItem;
  sealId: string;
  serialNumber: string;
  onClose: () => void;
  onPrintComplete: () => void;
}

export function ThermalSealPrinter({
  isOpen,
  item,
  sealId,
  serialNumber,
  onClose,
  onPrintComplete,
}: ThermalSealPrinterProps) {
  const { addToast } = useToast();

  if (!isOpen) return null;

  const handlePrint = () => {
    addToast({
      title: "Holographic Seal Dispatched to Thermal Roll",
      description: `Seal ${sealId} sent to 50x25mm thermal adhesive printer. Registered in cryptographic audit ledger.`,
      variant: "success",
    });
    onPrintComplete();
    window.print();
  };

  return (
    <div className="printer-modal-backdrop" data-testid="thermal-seal-printer-modal">
      <div className="printer-modal-card">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="header-pill">Godown Station 01 · 50x25mm Adhesive Roll</div>
            <h2 className="modal-title">Destructive Holographic Seal Printer</h2>
            <p className="modal-sub">
              Crockford Base32 cryptographic serial assigned to Order {item.orderNumber}.
            </p>
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* 50mm x 25mm Thermal Label Physical Preview */}
        <div className="label-preview-container">
          <div className="thermal-label-roll" data-testid="thermal-seal-label">
            {/* Holographic Iridescent Security Edge */}
            <div className="holographic-edge-strip">
              <span>★ NCA GENUINE SECURITY ★ VOID IF BROKEN ★ NAWABPUR COMPLEX ★</span>
            </div>

            {/* Label Body */}
            <div className="label-content-grid">
              {/* Left Column: QR Code */}
              <div className="label-qr-wrap">
                <div className="qr-sim">
                  <span className="qr-core">🛡️</span>
                </div>
                <span className="qr-sub">SCAN TO VERIFY</span>
              </div>

              {/* Right Column: Serial & Micro-print */}
              <div className="label-text-wrap">
                <div className="brand-micro">NCAMart Quality Certified</div>
                <div className="seal-id-display font-mono" data-testid="thermal-seal-id">
                  {sealId}
                </div>
                <div className="sku-meta font-mono">
                  <span>{item.skuCode}</span>
                  <span className="dot">·</span>
                  <span>SN: {serialNumber}</span>
                </div>
                <div className="tamper-warn">TAMPER EVIDENT · DESTRUCTIVE VOID FOIL</div>
              </div>
            </div>
          </div>

          <span className="preview-caption">
            Standard 50mm x 25mm Adhesive Label Roll Preview (Actual scale ~ 190px x 95px)
          </span>
        </div>

        {/* Product Inspection Details */}
        <div className="inspection-meta-box">
          <div className="meta-row">
            <span>Product SKU:</span>
            <strong>{item.skuTitle}</strong>
          </div>
          <div className="meta-row">
            <span>Wholesale Stall:</span>
            <span>{item.stallName} ({item.marketName})</span>
          </div>
          <div className="meta-row">
            <span>Intake Runner:</span>
            <span>{item.runnerName} (Memo: {item.voucherMemoNumber})</span>
          </div>
          <div className="meta-row">
            <span>Authenticity Tier:</span>
            <span className={item.tier === "AUTHENTIC" ? "tier-auth" : "tier-budget"}>
              {item.tier === "AUTHENTIC" ? "100% Authentic" : "Budget Smart Tested OEM"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn-cancel">
            Close
          </button>
          <button
            type="button"
            className="btn-print"
            onClick={handlePrint}
            data-testid="btn-execute-seal-print"
          >
            <span>🖨️ Print 50x25mm Label &amp; Apply Seal</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .printer-modal-backdrop {
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

        .printer-modal-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          max-width: 500px;
          width: 100%;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header-pill {
          font-size: 10px;
          font-weight: 800;
          color: #f59e0b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 900;
          margin: 4px 0 2px 0;
        }

        .modal-sub {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          border: none;
          cursor: pointer;
        }

        /* Label Roll Preview */
        .label-preview-container {
          background: #020617;
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .thermal-label-roll {
          width: 340px;
          height: 170px;
          background: #ffffff;
          color: #000000;
          border-radius: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          border: 2px solid #000;
        }

        .holographic-edge-strip {
          background: linear-gradient(
            90deg,
            #f59e0b 0%,
            #ec4899 25%,
            #3b82f6 50%,
            #10b981 75%,
            #f59e0b 100%
          );
          color: #000;
          font-size: 7px;
          font-weight: 900;
          padding: 2px 4px;
          text-align: center;
          white-space: nowrap;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #000;
        }

        .label-content-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 80px 1fr;
          padding: 10px;
          gap: 12px;
          align-items: center;
        }

        .label-qr-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .qr-sim {
          width: 64px;
          height: 64px;
          background: #000;
          color: #fff;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qr-core {
          font-size: 26px;
        }

        .qr-sub {
          font-size: 7px;
          font-weight: 800;
          color: #000;
        }

        .label-text-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .brand-micro {
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .seal-id-display {
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 1px;
          color: #000;
          margin: 2px 0;
        }

        .sku-meta {
          font-size: 9px;
          font-weight: 700;
          color: #333;
          display: flex;
          gap: 4px;
        }

        .tamper-warn {
          font-size: 7px;
          font-weight: 900;
          color: #b91c1c;
          letter-spacing: 0.3px;
          margin-top: 4px;
        }

        .preview-caption {
          font-size: 11px;
          color: #64748b;
          text-align: center;
        }

        /* Inspection Details */
        .inspection-meta-box {
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          color: #cbd5e1;
        }

        .tier-auth {
          color: #f59e0b;
          font-weight: 800;
        }

        .tier-budget {
          color: #14b8a6;
          font-weight: 800;
        }

        /* Actions */
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .btn-cancel {
          padding: 10px 16px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: none;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-print {
          padding: 10px 18px;
          border-radius: 8px;
          background: #f59e0b;
          color: #0f172a;
          font-size: 12px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-print:hover {
          background: #fbbf24;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .thermal-label-roll,
          .thermal-label-roll * {
            visibility: visible;
          }
          .thermal-label-roll {
            position: fixed;
            left: 0;
            top: 0;
            width: 50mm !important;
            height: 25mm !important;
            box-shadow: none;
            border: none;
          }
        }
      `}</style>
    </div>
  );
}
