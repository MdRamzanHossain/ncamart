"use client";

import React, { useState } from "react";
import type { JournalEntry, CourierRemittanceBatch, TrialBalanceRow } from "./types";
import { MOCK_JOURNAL_ENTRIES, MOCK_REMITTANCE_BATCHES, MOCK_TRIAL_BALANCE } from "./mockData";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";

export interface DoubleEntryLedgerViewProps {
  initialTab?: "LEDGER" | "COURIER_RECONCILER" | "TRIAL_BALANCE";
}

export function DoubleEntryLedgerView({ initialTab = "LEDGER" }: DoubleEntryLedgerViewProps = {}) {
  const [activeTab, setActiveTab] = useState<"LEDGER" | "COURIER_RECONCILER" | "TRIAL_BALANCE">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("ALL");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(MOCK_JOURNAL_ENTRIES);
  const [remittanceBatches, setRemittanceBatches] = useState<CourierRemittanceBatch[]>(MOCK_REMITTANCE_BATCHES);

  const { addToast } = useToast();

  // Filter Journal Entries
  const filteredEntries = journalEntries.filter((entry) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      entry.entryNumber.toLowerCase().includes(q) ||
      entry.referenceNumber.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (accountFilter !== "ALL") {
      const hasAccount = entry.lines.some((l) => l.accountCode === accountFilter);
      if (!hasAccount) return false;
    }

    return true;
  });

  // Reconcile Remittance Batch
  const handleReconcileBatch = (batchId: string) => {
    setRemittanceBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, status: "BALANCED" as const } : b))
    );
    addToast({
      title: "Remittance Batch Reconciled",
      description: `Batch ${batchId} matched against bank remittance deposit. Courier receivable ledger updated.`,
      variant: "success",
    });
  };

  // CSV Export
  const handleExportVatRegister = () => {
    addToast({
      title: "Mushak 6.3 Sales Register Exported",
      description: "NBR-compliant VAT sales tax register generated as CSV download.",
      variant: "default",
    });
  };

  const handleExportTrialBalance = () => {
    addToast({
      title: "Trial Balance Exported",
      description: "General ledger balance sheet exported as CSV.",
      variant: "default",
    });
  };

  // Trial Balance Totals
  const totalDebits = MOCK_TRIAL_BALANCE.reduce((sum, r) => sum + r.debitPaisa, 0);
  const totalCredits = MOCK_TRIAL_BALANCE.reduce((sum, r) => sum + r.creditPaisa, 0);
  const isTrialBalanced = totalDebits === totalCredits;

  return (
    <div className="finance-view" data-testid="double-entry-finance-view">
      {/* Top Header */}
      <div className="finance-header">
        <div>
          <div className="header-pill">Double-Entry Accounting Core · PRD §3.13</div>
          <h1 className="finance-title">Financial Ledger &amp; Settlement Reconciler</h1>
          <p className="finance-sub">
            Immutable general journal, automated T-accounts, courier COD matching, and NBR Mushak 6.3 compliance.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="header-exports">
          <button
            type="button"
            className="btn-export"
            onClick={handleExportVatRegister}
            data-testid="btn-export-mushak"
          >
            📥 Export Mushak 6.3 (VAT)
          </button>
          <button
            type="button"
            className="btn-export btn-accent"
            onClick={handleExportTrialBalance}
            data-testid="btn-export-trial-balance"
          >
            📊 Export Trial Balance
          </button>
        </div>
      </div>

      {/* Main View Tabs */}
      <div className="finance-tabs-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === "LEDGER" ? "active" : ""}`}
          onClick={() => setActiveTab("LEDGER")}
          data-testid="tab-general-ledger"
        >
          📖 General Ledger Explorer
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "COURIER_RECONCILER" ? "active" : ""}`}
          onClick={() => setActiveTab("COURIER_RECONCILER")}
          data-testid="tab-courier-reconciler"
        >
          🚚 Courier COD Settlement Reconciler
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "TRIAL_BALANCE" ? "active" : ""}`}
          onClick={() => setActiveTab("TRIAL_BALANCE")}
          data-testid="tab-trial-balance"
        >
          ⚖️ Trial Balance Validator
        </button>
      </div>

      {/* Tab 1: General Ledger Explorer */}
      {activeTab === "LEDGER" && (
        <section className="ledger-section" data-testid="general-ledger-explorer">
          {/* Controls */}
          <div className="controls-row">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search Entry #, Order Number, or Memo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="ledger-search-input"
              />
            </div>

            <div className="account-filter-select-wrap">
              <label htmlFor="account-filter-select" className="filter-label">Filter by Account:</label>
              <select
                id="account-filter-select"
                className="account-select"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                data-testid="account-filter-select"
              >
                <option value="ALL">All Accounts (Full Journal)</option>
                <option value="1020">1020 Cash – Runner Float</option>
                <option value="1100">1100 SSLCommerz Clearing</option>
                <option value="1110">1110 Courier COD Receivable</option>
                <option value="1200">1200 Inventory – In Transit</option>
                <option value="2000">2000 Customer Advances</option>
                <option value="2100">2100 VAT Payable (Mushak 6.3)</option>
                <option value="4000">4000 Revenue – Retail Sales</option>
              </select>
            </div>
          </div>

          {/* Journal Entries List */}
          <div className="journal-entries-stack">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="journal-card" data-testid={`journal-entry-${entry.id}`}>
                {/* Entry Header */}
                <div className="journal-entry-header">
                  <div className="header-meta">
                    <span className="entry-num font-mono">{entry.entryNumber}</span>
                    <span className="event-badge">{entry.eventType}</span>
                    <span className="ref-num font-mono">Ref: {entry.referenceNumber}</span>
                    <span className="entry-time">{entry.timestamp}</span>
                  </div>

                  <div className="balance-indicator">
                    {entry.isBalanced ? (
                      <span className="badge-balanced">✓ Balanced: Debits == Credits</span>
                    ) : (
                      <span className="badge-discrepancy">⚠️ Unbalanced Discrepancy</span>
                    )}
                  </div>
                </div>

                <div className="entry-desc">{entry.description}</div>

                {/* T-Account Lines Table */}
                <div className="t-account-table-wrap">
                  <table className="t-table">
                    <thead>
                      <tr>
                        <th className="th-code">Account Code</th>
                        <th>Account Title &amp; Sub-Ledger Memo</th>
                        <th className="th-num">Debit (BDT ৳)</th>
                        <th className="th-num">Credit (BDT ৳)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="td-code font-mono">{line.accountCode}</td>
                          <td className="td-account">
                            <span className="acc-name">{line.accountName}</span>
                            {line.memo && <span className="acc-memo">{line.memo}</span>}
                          </td>
                          <td className="td-num debit-col font-mono">
                            {line.debitPaisa > 0 ? formatPaisa(line.debitPaisa) : "—"}
                          </td>
                          <td className="td-num credit-col font-mono">
                            {line.creditPaisa > 0 ? formatPaisa(line.creditPaisa) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="t-footer-row">
                        <td colSpan={2} className="footer-label">
                          Total Balanced Journal Movement:
                        </td>
                        <td className="td-num font-mono debit-total">
                          {formatPaisa(entry.totalDebitPaisa)}
                        </td>
                        <td className="td-num font-mono credit-total">
                          {formatPaisa(entry.totalCreditPaisa)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 2: Courier Settlement Reconciler */}
      {activeTab === "COURIER_RECONCILER" && (
        <section className="reconciler-section" data-testid="courier-settlement-reconciler">
          <div className="reconciler-intro">
            <h2 className="section-title">Courier COD Bank Remittance Matching</h2>
            <p className="section-sub">
              Cross-checks courier bank remittance statements against delivered parcel COD values. Overdue items &gt; 7 days require financial escalation per PRD §3.13.
            </p>
          </div>

          <div className="batches-stack">
            {remittanceBatches.map((batch) => (
              <div key={batch.id} className="batch-card" data-testid={`remittance-batch-${batch.id}`}>
                <div className="batch-header">
                  <div>
                    <span className="courier-tag">
                      {batch.courier === "Pathao" ? "🏍️ Pathao Courier" : "🚚 Steadfast Logistics"}
                    </span>
                    <h3 className="batch-num font-mono">{batch.batchNumber}</h3>
                    <div className="batch-meta">
                      <span>Date: {batch.remittanceDate}</span>
                      <span>· Deposited to: {batch.bankAccount}</span>
                    </div>
                  </div>

                  <div className="batch-totals">
                    <div className="total-item">
                      <span className="total-lbl">Total COD Collected:</span>
                      <strong className="font-mono">{formatPaisa(batch.totalCodPaisa)}</strong>
                    </div>
                    <div className="total-item">
                      <span className="total-lbl">Courier Service Fees:</span>
                      <span className="font-mono text-crimson">-{formatPaisa(batch.totalFeesPaisa)}</span>
                    </div>
                    <div className="total-item net-item">
                      <span className="total-lbl">Net Bank Remitted:</span>
                      <strong className="font-mono text-emerald">{formatPaisa(batch.netRemittedPaisa)}</strong>
                    </div>
                  </div>
                </div>

                {/* Parcels List */}
                <div className="parcels-table-wrap">
                  <table className="parcels-table">
                    <thead>
                      <tr>
                        <th>Order Number</th>
                        <th>Consignment ID</th>
                        <th>Delivery Date</th>
                        <th>Age</th>
                        <th>COD Value</th>
                        <th>Courier Fee</th>
                        <th>Net Remittance</th>
                        <th>Audit Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.parcels.map((parcel) => {
                        const isOverdue = parcel.daysOutstanding >= 7;
                        return (
                          <tr
                            key={parcel.orderNumber}
                            className={isOverdue ? "overdue-row" : ""}
                          >
                            <td className="font-mono">{parcel.orderNumber}</td>
                            <td className="font-mono">{parcel.consignmentId}</td>
                            <td>{parcel.deliveryDate}</td>
                            <td>
                              <span
                                className={`age-pill ${
                                  isOverdue ? "age-overdue" : "age-normal"
                                }`}
                              >
                                {parcel.daysOutstanding} days
                              </span>
                            </td>
                            <td className="font-mono">{formatPaisa(parcel.codAmountPaisa)}</td>
                            <td className="font-mono text-crimson">
                              -{formatPaisa(parcel.courierFeePaisa)}
                            </td>
                            <td className="font-mono text-emerald">
                              {formatPaisa(parcel.netRemittedPaisa)}
                            </td>
                            <td>
                              {isOverdue ? (
                                <span className="status-overdue" data-testid="status-unreconciled-overdue">
                                  ⚠️ UNRECONCILED (&gt;7d Overdue)
                                </span>
                              ) : (
                                <span className="status-matched">✓ MATCHED</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {batch.status === "DISCREPANCY_FLAGGED" && (
                  <div className="batch-action-bar">
                    <button
                      type="button"
                      className="btn-reconcile"
                      onClick={() => handleReconcileBatch(batch.id)}
                      data-testid={`btn-reconcile-batch-${batch.id}`}
                    >
                      ✓ Resolve &amp; Post Bank Reconciliation Journal
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 3: Trial Balance Validator */}
      {activeTab === "TRIAL_BALANCE" && (
        <section className="trial-balance-section" data-testid="trial-balance-validator">
          <div className="tb-header">
            <div>
              <h2 className="section-title">Trial Balance (General Ledger Summary)</h2>
              <p className="section-sub">
                Validates zero discrepancy across Assets, Liabilities, Equity, Revenues, and Expenses.
              </p>
            </div>

            <div className="tb-status-badge">
              {isTrialBalanced ? (
                <span className="badge-balanced">✓ Trial Balance Balanced (Debits == Credits)</span>
              ) : (
                <span className="badge-discrepancy">⚠️ Discrepancy Detected</span>
              )}
            </div>
          </div>

          <div className="tb-table-wrap">
            <table className="tb-table">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th className="th-num">Debit Balance (BDT ৳)</th>
                  <th className="th-num">Credit Balance (BDT ৳)</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TRIAL_BALANCE.map((row) => (
                  <tr key={row.code}>
                    <td className="font-mono">{row.code}</td>
                    <td className="font-bold">{row.name}</td>
                    <td>
                      <span className="type-pill">{row.type}</span>
                    </td>
                    <td className="th-num font-mono">
                      {row.debitPaisa > 0 ? formatPaisa(row.debitPaisa) : "—"}
                    </td>
                    <td className="th-num font-mono">
                      {row.creditPaisa > 0 ? formatPaisa(row.creditPaisa) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tb-footer-row">
                  <td colSpan={3} className="footer-label font-bold">
                    Total General Ledger Balances:
                  </td>
                  <td className="th-num font-mono font-bold debit-total">
                    {formatPaisa(totalDebits)}
                  </td>
                  <td className="th-num font-mono font-bold credit-total">
                    {formatPaisa(totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <style jsx>{`
        .finance-view {
          flex: 1;
          padding: 24px 32px;
          background: #020617;
          min-height: 100vh;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        .finance-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-pill {
          font-size: 10px;
          font-weight: 800;
          color: #38bdf8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .finance-title {
          font-size: 24px;
          font-weight: 900;
          margin: 0 0 4px 0;
          letter-spacing: -0.4px;
        }

        .finance-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .header-exports {
          display: flex;
          gap: 10px;
        }

        .btn-export {
          padding: 8px 14px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-accent {
          background: rgba(56, 189, 248, 0.15);
          border-color: rgba(56, 189, 248, 0.3);
          color: #38bdf8;
        }

        /* Tabs */
        .finance-tabs-bar {
          display: flex;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 4px;
          gap: 4px;
          margin-bottom: 20px;
          width: fit-content;
        }

        .tab-btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }

        .tab-btn.active {
          background: #1e293b;
          color: #f59e0b;
        }

        /* Controls */
        .controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px;
          width: 340px;
        }

        .search-icon {
          font-size: 14px;
        }

        .search-input {
          background: none;
          border: none;
          color: #f8fafc;
          font-size: 12px;
          outline: none;
          width: 100%;
        }

        .account-filter-select-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-label {
          font-size: 11px;
          color: #94a3b8;
        }

        .account-select {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 8px 12px;
          color: #f8fafc;
          font-size: 11px;
          font-weight: 700;
          outline: none;
          cursor: pointer;
        }

        /* Journal Card */
        .journal-entries-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .journal-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .journal-entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .header-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .entry-num {
          font-size: 13px;
          font-weight: 900;
          color: #f8fafc;
        }

        .event-badge {
          font-size: 9px;
          font-weight: 800;
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .ref-num {
          font-size: 11px;
          color: #f59e0b;
        }

        .entry-time {
          font-size: 10px;
          color: #64748b;
        }

        .badge-balanced {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 9999px;
        }

        .badge-discrepancy {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 9999px;
        }

        .entry-desc {
          font-size: 12px;
          color: #cbd5e1;
        }

        /* T-Table */
        .t-account-table-wrap {
          background: #0b1329;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          overflow-x: auto;
        }

        .t-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          text-align: left;
        }

        .t-table th {
          background: #0f172a;
          color: #94a3b8;
          font-weight: 700;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .t-table td {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          vertical-align: middle;
        }

        .th-code,
        .td-code {
          width: 100px;
          color: #f59e0b;
        }

        .td-account {
          display: flex;
          flex-direction: column;
        }

        .acc-name {
          color: #f8fafc;
          font-weight: 700;
        }

        .acc-memo {
          font-size: 10px;
          color: #64748b;
        }

        .th-num,
        .td-num {
          text-align: right;
          width: 140px;
        }

        .debit-col {
          color: #38bdf8;
        }

        .credit-col {
          color: #10b981;
        }

        .t-footer-row td {
          background: #0f172a;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-weight: 800;
        }

        .footer-label {
          text-align: right;
          color: #94a3b8;
        }

        .debit-total {
          color: #38bdf8;
        }

        .credit-total {
          color: #10b981;
        }

        .font-mono {
          font-family: monospace;
        }

        .font-bold {
          font-weight: 700;
        }

        /* Courier Reconciler */
        .reconciler-intro,
        .tb-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 2px 0;
          color: #f8fafc;
        }

        .section-sub {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }

        .batches-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .batch-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .batch-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
        }

        .courier-tag {
          font-size: 11px;
          font-weight: 800;
          color: #38bdf8;
        }

        .batch-num {
          font-size: 16px;
          font-weight: 900;
          margin: 2px 0;
        }

        .batch-meta {
          font-size: 11px;
          color: #94a3b8;
        }

        .batch-totals {
          display: flex;
          gap: 16px;
          background: #0b1329;
          border-radius: 8px;
          padding: 10px 14px;
        }

        .total-item {
          display: flex;
          flex-direction: column;
          font-size: 11px;
        }

        .total-lbl {
          color: #64748b;
          font-size: 10px;
        }

        .text-crimson {
          color: #ef4444;
        }

        .text-emerald {
          color: #10b981;
        }

        /* Parcels Table */
        .parcels-table-wrap,
        .tb-table-wrap {
          background: #0b1329;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          overflow-x: auto;
        }

        .parcels-table,
        .tb-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          text-align: left;
        }

        .parcels-table th,
        .tb-table th {
          background: #0f172a;
          color: #94a3b8;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .parcels-table td,
        .tb-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .overdue-row td {
          background: rgba(239, 68, 68, 0.08);
        }

        .age-pill {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .age-normal {
          background: rgba(255, 255, 255, 0.05);
          color: #cbd5e1;
        }

        .age-overdue {
          background: #ef4444;
          color: #fff;
        }

        .status-matched {
          color: #10b981;
          font-weight: 800;
        }

        .status-overdue {
          color: #ef4444;
          font-weight: 800;
        }

        .batch-action-bar {
          display: flex;
          justify-content: flex-end;
        }

        .btn-reconcile {
          padding: 8px 16px;
          border-radius: 6px;
          background: #10b981;
          color: #022c22;
          font-size: 11px;
          font-weight: 800;
          border: none;
          cursor: pointer;
        }

        .type-pill {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 5px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
        }

        .tb-footer-row td {
          background: #0f172a;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
