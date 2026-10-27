"use client";

import React, { useState } from "react";
import type { StaffUser } from "./types";
import { useToast } from "@/components/ui/toast";

export interface TotpResetModalProps {
  staff: StaffUser;
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: (staffId: string) => void;
}

export function TotpResetModal({
  staff,
  isOpen,
  onClose,
  onConfirmReset,
}: TotpResetModalProps) {
  const [copied, setCopied] = useState(false);
  const [tempPassword] = useState(() => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `NCA-Staff-2026-${rand}!Sec`;
  });

  const { addToast } = useToast();

  if (!isOpen) return null;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(tempPassword);
    }
    setCopied(true);
    addToast({
      title: "Temporary Password Copied",
      description: "Send this secure temporary password to staff member for next login.",
      variant: "success",
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleConfirm = () => {
    onConfirmReset(staff.id);
    addToast({
      title: "TOTP 2FA Reset Successful",
      description: `Two-factor authentication secret reset for ${staff.name}. Staff must re-scan QR upon next sign-in.`,
      variant: "default",
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" data-testid="totp-reset-modal">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-pill">Credential Governance · PRD §3.9</div>
            <h2 className="modal-title">Staff TOTP 2FA Reset</h2>
            <p className="modal-sub">
              Reset two-factor authentication authenticator app key for <strong>{staff.name}</strong>
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} data-testid="btn-close-totp-modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="alert-warning">
            ⚠️ <strong>Security Notice:</strong> Resetting 2FA immediately invalidates all active device sessions for this staff account. They will be required to scan a new TOTP secret QR code upon logging in with the temporary password below.
          </div>

          <div className="field-group">
            <label className="field-label">Generated Temporary Password (One-Time Use):</label>
            <div className="password-display-box">
              <span className="font-mono temp-pwd" data-testid="generated-temp-password">
                {tempPassword}
              </span>
              <button
                type="button"
                className={`btn-copy ${copied ? "btn-copied" : ""}`}
                onClick={handleCopy}
                data-testid="btn-copy-temp-password"
              >
                {copied ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>
            <p className="field-hint">
              This password expires in 2 hours and must be changed on initial authentication.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={handleConfirm}
            data-testid="btn-confirm-totp-reset"
          >
            🔄 Invalidate Sessions &amp; Reset 2FA
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        }

        .modal-dialog {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          max-width: 560px;
          width: 100%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          overflow: hidden;
        }

        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: #0b1329;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .modal-pill {
          font-size: 10px;
          font-weight: 800;
          color: #f59e0b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0;
        }

        .modal-sub {
          font-size: 12px;
          color: #94a3b8;
          margin: 4px 0 0 0;
        }

        .btn-close {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 16px;
          cursor: pointer;
        }

        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .alert-warning {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 12px 14px;
          color: #f59e0b;
          font-size: 12px;
          line-height: 1.5;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-size: 12px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .password-display-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #030712;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 10px 14px;
        }

        .temp-pwd {
          color: #38bdf8;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .btn-copy {
          background: rgba(56, 189, 248, 0.15);
          border: 1px solid rgba(56, 189, 248, 0.3);
          color: #38bdf8;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-copy:hover {
          background: rgba(56, 189, 248, 0.25);
        }

        .btn-copied {
          background: #10b981;
          color: #032b1f;
          border-color: #10b981;
        }

        .field-hint {
          font-size: 11px;
          color: #64748b;
          margin: 0;
        }

        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: #0b1329;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn-secondary {
          padding: 10px 18px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-danger {
          padding: 10px 18px;
          background: #ef4444;
          border: none;
          border-radius: 8px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.1s ease;
        }

        .btn-danger:active {
          transform: scale(0.98);
        }

        .font-mono {
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}
