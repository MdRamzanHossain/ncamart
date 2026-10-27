"use client";

import React, { useState } from "react";
import type { VoidReason } from "./types";
import { useToast } from "@/components/ui/toast";

interface SealVoidModalProps {
  isOpen: boolean;
  activeSealId?: string;
  onClose: () => void;
  onVoidConfirmed: (sealId: string, reason: VoidReason, notes?: string) => void;
}

export function SealVoidModal({
  isOpen,
  activeSealId = "NCA-8X2M-9P4K",
  onClose,
  onVoidConfirmed,
}: SealVoidModalProps) {
  const { addToast } = useToast();
  const [sealInput, setSealInput] = useState(activeSealId);
  const [reason, setReason] = useState<VoidReason>("PRINTER_JAM");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const handleConfirmVoid = () => {
    if (!sealInput.trim()) {
      addToast({
        title: "Validation Error",
        description: "Seal ID is required to register a void audit entry.",
        variant: "destructive",
      });
      return;
    }

    onVoidConfirmed(sealInput.trim(), reason, notes);

    addToast({
      title: "Seal Voided in Cryptographic Ledger",
      description: `Seal ${sealInput} voided with reason: ${reason}. Security audit log registered.`,
      variant: "warning",
    });

    onClose();
  };

  return (
    <div className="void-modal-backdrop" data-testid="seal-void-modal">
      <div className="void-modal-card">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="header-pill">Cryptographic Security Protocol §3.2.3</div>
            <h2 className="modal-title">Void Damaged Holographic Seal</h2>
            <p className="modal-sub">
              Register physically destroyed or misprinted adhesive labels to prevent seal cloning and audit fraud.
            </p>
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Void Details Form */}
        <div className="void-form">
          <div className="form-group">
            <label className="input-label">Crockford Base32 Seal ID to Void</label>
            <input
              type="text"
              className="text-input font-mono"
              value={sealInput}
              onChange={(e) => setSealInput(e.target.value.toUpperCase())}
              placeholder="e.g. NCA-8X2M-9P4K"
              data-testid="input-void-seal-id"
            />
          </div>

          <div className="form-group">
            <label className="input-label">Mandatory Void Reason</label>
            <select
              className="text-input"
              value={reason}
              onChange={(e) => setReason(e.target.value as VoidReason)}
              data-testid="select-void-reason"
            >
              <option value="PRINTER_JAM">🖨️ PRINTER_JAM (Paper/Heater Jammed)</option>
              <option value="RIBBON_TEAR">🎗️ RIBBON_TEAR (Thermal Ribbon Broken)</option>
              <option value="STICKER_DAMAGED">💥 STICKER_DAMAGED (Foil Peeled/Torn)</option>
              <option value="MISPRINTED_BARCODE">🔍 MISPRINTED_BARCODE (Unscannable QR)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="input-label">Technician Notes (Optional)</label>
            <textarea
              className="textarea-input"
              placeholder="e.g. Label roll wrinkled inside Godown Station 01 thermal feed."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Warning Banner */}
        <div className="security-notice">
          <span className="notice-icon">🛡️</span>
          <span>
            Voiding a seal irreversibly invalidates it in the public <code>/verify</code> portal. Attempts to scan this label will show an official VOIDED warning.
          </span>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button
            type="button"
            className="btn-confirm-void"
            onClick={handleConfirmVoid}
            data-testid="btn-confirm-void-seal"
          >
            <span>⚠️ Invalidate &amp; Record Void in Audit Log</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .void-modal-backdrop {
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

        .void-modal-card {
          background: #0f172a;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 16px;
          max-width: 480px;
          width: 100%;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
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
          color: #ef4444;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 900;
          margin: 4px 0 2px 0;
          color: #f8fafc;
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

        .void-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-label {
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .text-input,
        .textarea-input {
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 10px 12px;
          color: #f8fafc;
          font-size: 12px;
          outline: none;
        }

        .text-input:focus,
        .textarea-input:focus {
          border-color: #ef4444;
        }

        .font-mono {
          font-family: monospace;
          letter-spacing: 0.5px;
        }

        .security-notice {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 11px;
          color: #fca5a5;
          line-height: 1.4;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 4px;
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

        .btn-confirm-void {
          padding: 10px 18px;
          border-radius: 8px;
          background: #dc2626;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-confirm-void:hover {
          background: #b91c1c;
        }
      `}</style>
    </div>
  );
}
