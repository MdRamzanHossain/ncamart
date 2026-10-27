"use client";

import React from "react";
import type { CustomerPiiRecord } from "./types";

export interface AnonymizeConfirmModalProps {
  customer: CustomerPiiRecord;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerId: string) => void;
}

export function AnonymizeConfirmModal({
  customer,
  isOpen,
  onClose,
  onConfirm,
}: AnonymizeConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" data-testid="anonymize-confirm-modal">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-pill">Privacy &amp; Data Retention · PRD §3.18</div>
            <h2 className="modal-title">Irreversible Customer Anonymization</h2>
            <p className="modal-sub">
              Right to be Forgotten Execution for <strong>{customer.name}</strong> ({customer.id})
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} data-testid="btn-close-anonymize-modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="alert-destructive">
            🚨 <strong>Warning:</strong> This action is permanent and cannot be undone. All personal customer identifiers will be permanently redacted or hashed.
          </div>

          <div className="protocol-summary-box">
            <h4 className="box-title">Compliance Protocol Execution Checklist (PRD §3.18 &amp; DECISIONS.md #64):</h4>
            <ul className="check-list">
              <li>
                <span className="bullet">✓</span>
                <span><strong>Phone Number Hashing:</strong> Irreversibly replaced with SHA-256 cryptographic hash.</span>
              </li>
              <li>
                <span className="bullet">✓</span>
                <span><strong>Name Anonymization:</strong> Replaced with <code>ANONYMIZED_USER_{customer.id.replace("CUST-", "")}</code>.</span>
              </li>
              <li>
                <span className="bullet">✓</span>
                <span><strong>Address Purge:</strong> Physical delivery addresses &amp; coordinates cleared from database.</span>
              </li>
              <li>
                <span className="bullet">✓</span>
                <span><strong>Session Invalidation:</strong> All active mobile &amp; web authentication sessions immediately terminated.</span>
              </li>
              <li>
                <span className="bullet-preserve">⚖️</span>
                <span>
                  <strong>Statutory Financial Ledger Retention:</strong> All {customer.journalEntriesCount} double-entry general ledger records, Mushak 6.3 VAT sales registers, and bank settlement receipts remain intact for Bangladesh NBR 6-year statutory retention.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-destructive"
            onClick={() => onConfirm(customer.id)}
            data-testid="btn-confirm-anonymize"
          >
            🔒 Execute Cryptographic Anonymization
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
          max-width: 600px;
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
          color: #ef4444;
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
          gap: 16px;
        }

        .alert-destructive {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 8px;
          padding: 12px 14px;
          color: #fca5a5;
          font-size: 12px;
          line-height: 1.5;
        }

        .protocol-summary-box {
          background: #030712;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 16px;
        }

        .box-title {
          font-size: 12px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0 0 12px 0;
        }

        .check-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 12px;
          color: #cbd5e1;
        }

        .check-list li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.4;
        }

        .bullet {
          color: #10b981;
          font-weight: 900;
        }

        .bullet-preserve {
          color: #38bdf8;
        }

        code {
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 5px;
          border-radius: 4px;
          font-family: monospace;
          color: #38bdf8;
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

        .btn-destructive {
          padding: 10px 20px;
          background: #dc2626;
          border: none;
          border-radius: 8px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.1s ease;
        }

        .btn-destructive:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
