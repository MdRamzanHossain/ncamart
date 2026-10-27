"use client";

import React, { useState } from "react";
import { formatPaisaToBDT, type StoreCreditWalletData, type CreditTransaction } from "./types";
import { useToast } from "@/components/ui/toast";

interface StoreCreditWalletViewProps {
  initialData: StoreCreditWalletData;
}

export function StoreCreditWalletView({ initialData }: StoreCreditWalletViewProps) {
  const [data, setData] = useState<StoreCreditWalletData>(initialData);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<"BKASH" | "NAGAD" | "BANK">("BKASH");
  const [withdrawAmountBDT, setWithdrawAmountBDT] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [branchRouting, setBranchRouting] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addToast } = useToast();

  const maxWithdrawableBDT = data.balancePaisa / 100;

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmountBDT);

    if (isNaN(amount) || amount < 100) {
      addToast({
        title: "Minimum Withdrawal ৳100",
        description: "The minimum store credit withdrawal amount is ৳100.00.",
        variant: "error",
      });
      return;
    }

    if (amount > maxWithdrawableBDT) {
      addToast({
        title: "Insufficient Store Credit",
        description: `Your withdrawable balance is ৳${maxWithdrawableBDT.toFixed(2)}.`,
        variant: "error",
      });
      return;
    }

    if (!accountNumber || accountNumber.trim().length < 10) {
      addToast({
        title: "Invalid Account Number",
        description: "Please enter a valid bKash/Nagad mobile number or Bank account.",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);

    // Optimistically deduct and add pending withdrawal transaction
    const withdrawalPaisa = Math.round(amount * 100);
    const newBalancePaisa = data.balancePaisa - withdrawalPaisa;

    const newTx: CreditTransaction = {
      id: `tx_${Date.now()}`,
      amountPaisa: -withdrawalPaisa,
      type: "WITHDRAWAL_PAYOUT",
      reference: `WDR-${Date.now().toString().slice(-6)}`,
      notes: `Withdrawal to ${withdrawMethod} (${accountNumber})`,
      createdAt: new Date().toISOString(),
      balanceAfterPaisa: newBalancePaisa,
    };

    setTimeout(() => {
      setData((prev) => ({
        ...prev,
        balancePaisa: newBalancePaisa,
        pendingWithdrawalPaisa: prev.pendingWithdrawalPaisa + withdrawalPaisa,
        transactions: [newTx, ...prev.transactions],
      }));

      setIsSubmitting(false);
      setIsWithdrawModalOpen(false);
      setWithdrawAmountBDT("");
      setAccountNumber("");

      addToast({
        title: "Withdrawal Requested",
        description: `৳${amount.toFixed(2)} transfer initiated. Processing within 1 business day per PRD §3.14.`,
        variant: "success",
      });
    }, 600);
  };

  return (
    <div className="wallet-view-container" role="region" aria-label="Store Credit Wallet">
      {/* Top Header Card with Large Balance Display */}
      <section className="wallet-hero-card">
        <div className="hero-content">
          <div className="balance-info">
            <div className="eyebrow-row">
              <span className="eyebrow">NCAMART STORE CREDIT BALANCE</span>
              <span className="instant-badge">⚡ Instant Checkout & Refund Settlement</span>
            </div>
            <h1 className="balance-display" data-testid="wallet-balance-amount">
              {formatPaisaToBDT(data.balancePaisa)}
            </h1>
            <p className="balance-sub">
              Usable on any product order, pre-order deposit, or balance settlement.
            </p>
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-withdraw"
              onClick={() => setIsWithdrawModalOpen(true)}
              disabled={data.balancePaisa < 10000} // Minimum ৳100
            >
              💸 Request Payout / Withdraw
            </button>
            <p className="payout-note">
              Bank Wire (EFTN) or bKash / Nagad • Dispatched in 24 Hours
            </p>
          </div>
        </div>

        {/* Financial Trust Micro-Bar */}
        <div className="hero-trust-bar">
          <div className="trust-item">
            <span className="trust-icon">🔒</span>
            <span>Segregated Escrow Ledger</span>
          </div>
          <div className="trust-item">
            <span className="trust-icon">📜</span>
            <span>Mushak 6.3 VAT Reconciled</span>
          </div>
          <div className="trust-item">
            <span className="trust-icon">🛡️</span>
            <span>Zero Expiration Guarantee</span>
          </div>
        </div>
      </section>

      {/* Ledger Transaction History Section */}
      <section className="transactions-section">
        <div className="section-header">
          <div>
            <h2>Credit Ledger History</h2>
            <p>Complete double-entry transaction record for your account.</p>
          </div>
          <span className="tx-count">
            {data.transactions.length} Total Entries
          </span>
        </div>

        {data.transactions.length === 0 ? (
          <div className="zero-state-card">
            <span className="zero-icon">💳</span>
            <h3>No Transactions Yet</h3>
            <p>
              When you receive RMA defect refunds or pre-order adjustments, your store credit will appear here.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="ledger-table" aria-label="Store credit ledger transactions">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Transaction Reference</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => {
                  const isCredit = tx.amountPaisa > 0;
                  const formattedDate = new Date(tx.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={tx.id} data-testid="transaction-row">
                      <td className="date-cell">{formattedDate}</td>
                      <td className="ref-cell">
                        <span className="ref-code">{tx.reference}</span>
                        {tx.notes && <span className="ref-notes">{tx.notes}</span>}
                      </td>
                      <td>
                        <span className={`type-badge type-${tx.type.toLowerCase()}`}>
                          {tx.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={`amount-cell text-right ${isCredit ? "credit" : "debit"}`}>
                        {isCredit ? "+" : ""}
                        {formatPaisaToBDT(tx.amountPaisa)}
                      </td>
                      <td className="balance-cell text-right">
                        {formatPaisaToBDT(tx.balanceAfterPaisa)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* WITHDRAW STORE CREDIT MODAL */}
      {isWithdrawModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="withdraw-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="withdraw-modal-title">Withdraw Store Credit</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsWithdrawModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="withdraw-form">
              <div className="available-notice">
                <span>Available Balance:</span>
                <strong>{formatPaisaToBDT(data.balancePaisa)}</strong>
              </div>

              {/* Method Selector */}
              <div className="form-group">
                <label className="field-label">Payout Channel</label>
                <div className="channel-pills">
                  <button
                    type="button"
                    className={`channel-pill ${withdrawMethod === "BKASH" ? "active" : ""}`}
                    onClick={() => setWithdrawMethod("BKASH")}
                  >
                    bKash Personal
                  </button>
                  <button
                    type="button"
                    className={`channel-pill ${withdrawMethod === "NAGAD" ? "active" : ""}`}
                    onClick={() => setWithdrawMethod("NAGAD")}
                  >
                    Nagad Personal
                  </button>
                  <button
                    type="button"
                    className={`channel-pill ${withdrawMethod === "BANK" ? "active" : ""}`}
                    onClick={() => setWithdrawMethod("BANK")}
                  >
                    Bank Wire (BEFTN)
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="form-group">
                <label htmlFor="withdraw-amount" className="field-label">
                  Withdrawal Amount (BDT ৳)
                </label>
                <div className="input-with-max">
                  <input
                    id="withdraw-amount"
                    type="number"
                    min="100"
                    max={maxWithdrawableBDT}
                    step="1"
                    placeholder="Enter amount (min ৳100)"
                    value={withdrawAmountBDT}
                    onChange={(e) => setWithdrawAmountBDT(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="max-btn"
                    onClick={() => setWithdrawAmountBDT(String(Math.floor(maxWithdrawableBDT)))}
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Account Details */}
              <div className="form-group">
                <label htmlFor="account-num" className="field-label">
                  {withdrawMethod === "BANK" ? "Bank Account Number" : `${withdrawMethod} Mobile Number`}
                </label>
                <input
                  id="account-num"
                  type="text"
                  placeholder={
                    withdrawMethod === "BANK" ? "e.g. 20501234567890" : "e.g. 017XXXXXXXX"
                  }
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
              </div>

              {withdrawMethod === "BANK" && (
                <>
                  <div className="form-group">
                    <label htmlFor="account-name" className="field-label">Account Holder Name</label>
                    <input
                      id="account-name"
                      type="text"
                      placeholder="As shown in bank records"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="bank-name" className="field-label">Bank Name</label>
                      <input
                        id="bank-name"
                        type="text"
                        placeholder="e.g. BRAC Bank Ltd"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="branch-routing" className="field-label">Routing Number</label>
                      <input
                        id="branch-routing"
                        type="text"
                        placeholder="e.g. 060261234"
                        value={branchRouting}
                        onChange={(e) => setBranchRouting(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsWithdrawModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Confirm Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .wallet-view-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        /* ---------------------------------------------------- */
        /* HERO BALANCE CARD */
        /* ---------------------------------------------------- */
        .wallet-hero-card {
          background: linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%);
          border-radius: var(--radius-xl, 1.25rem);
          color: #ffffff;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.4);
        }

        .hero-content {
          padding: 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
        }

        @media (max-width: 768px) {
          .hero-content {
            flex-direction: column;
            align-items: flex-start;
            padding: 1.5rem;
          }
        }

        .eyebrow-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .eyebrow {
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          font-weight: 800;
          color: #a7f3d0;
        }

        .instant-badge {
          font-size: 0.6875rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.15);
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }

        .balance-display {
          font-family: var(--font-mono, monospace);
          font-size: 2.5rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
        }

        @media (max-width: 480px) {
          .balance-display {
            font-size: 2rem;
          }
        }

        .balance-sub {
          font-size: 0.875rem;
          color: #d1fae5;
          max-width: 420px;
          line-height: 1.4;
        }

        .hero-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .hero-actions {
            align-items: flex-start;
            width: 100%;
          }
        }

        .btn-withdraw {
          background: #ffffff;
          color: #065f46;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
        }

        .btn-withdraw:hover:not(:disabled) {
          background: #f0fdf4;
          transform: translateY(-1px);
        }

        .btn-withdraw:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .payout-note {
          font-size: 0.6875rem;
          color: #a7f3d0;
        }

        .hero-trust-bar {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.75rem 2.5rem;
          gap: 2rem;
        }

        @media (max-width: 768px) {
          .hero-trust-bar {
            flex-direction: column;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
          }
        }

        .trust-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          color: #d1fae5;
          font-weight: 600;
        }

        /* ---------------------------------------------------- */
        /* TRANSACTIONS SECTION */
        /* ---------------------------------------------------- */
        .transactions-section {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 2rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        @media (max-width: 768px) {
          .transactions-section {
            padding: 1.5rem;
          }
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        .section-header h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.2rem;
        }

        .section-header p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .tx-count {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          background: var(--color-surface-subtle, #f8fafc);
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          border: 1px solid var(--color-border, #e2e8f0);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .ledger-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .ledger-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-secondary);
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        .ledger-table td {
          padding: 1rem;
          border-bottom: 1px solid var(--color-border, #f1f5f9);
          vertical-align: middle;
        }

        .text-right {
          text-align: right;
        }

        .date-cell {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
        }

        .ref-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .ref-code {
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .ref-notes {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .type-badge {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          display: inline-block;
          text-transform: capitalize;
        }

        .type-refund_rma,
        .type-compensation {
          background: #dcfce7;
          color: #15803d;
        }

        .type-preorder_forfeiture_credit {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .type-purchase_debit {
          background: #f1f5f9;
          color: #475569;
        }

        .type-withdrawal_payout {
          background: #fef2f2;
          color: #b91c1c;
        }

        .amount-cell {
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          white-space: nowrap;
        }

        .amount-cell.credit {
          color: #16a34a;
        }

        .amount-cell.debit {
          color: #dc2626;
        }

        .balance-cell {
          font-family: var(--font-mono, monospace);
          font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap;
        }

        .zero-state-card {
          padding: 3rem 1.5rem;
          text-align: center;
          color: var(--color-text-secondary);
        }

        .zero-icon {
          font-size: 2.5rem;
          margin-bottom: 0.75rem;
          display: block;
        }

        /* ---------------------------------------------------- */
        /* MODAL STYLES */
        /* ---------------------------------------------------- */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1.5rem;
        }

        .modal-content {
          background: var(--color-surface, #ffffff);
          border-radius: var(--radius-xl, 1.25rem);
          max-width: 480px;
          width: 100%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        .modal-header h3 {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .close-btn {
          background: transparent;
          border: none;
          font-size: 1.25rem;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .withdraw-form {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .available-notice {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: var(--color-surface-subtle, #f8fafc);
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .available-notice strong {
          color: #059669;
          font-family: var(--font-mono, monospace);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .field-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .channel-pills {
          display: flex;
          gap: 0.5rem;
        }

        .channel-pill {
          flex: 1;
          padding: 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-md, 0.5rem);
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .channel-pill.active {
          border-color: #059669;
          background: #dcfce7;
          color: #15803d;
          font-weight: 700;
        }

        .input-with-max {
          display: flex;
          position: relative;
        }

        .input-with-max input {
          width: 100%;
          padding: 0.625rem 4rem 0.625rem 0.875rem;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.9375rem;
          font-family: var(--font-mono, monospace);
        }

        .max-btn {
          position: absolute;
          right: 6px;
          top: 6px;
          bottom: 6px;
          padding: 0 0.625rem;
          font-size: 0.6875rem;
          font-weight: 800;
          color: #059669;
          background: #dcfce7;
          border: none;
          border-radius: var(--radius-sm, 0.375rem);
          cursor: pointer;
        }

        input[type="text"] {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.9375rem;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: #059669;
          color: #ffffff;
          border: none;
        }

        .btn-primary:hover:not(:disabled) {
          background: #047857;
        }

        .btn-secondary {
          background: transparent;
          color: var(--color-text-primary);
          border: 1px solid var(--color-border, #cbd5e1);
        }

        .btn-secondary:hover {
          background: var(--color-surface-subtle, #f8fafc);
        }
      `}</style>
    </div>
  );
}
