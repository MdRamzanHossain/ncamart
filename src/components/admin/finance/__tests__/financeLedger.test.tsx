import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { DoubleEntryLedgerView } from "../DoubleEntryLedgerView";
import { ToastProvider } from "@/components/ui/toast";

describe("F35: Double-Entry Financial Ledger Viewer & Settlements", () => {
  it("renders DoubleEntryLedgerView with navigation tabs and header export actions", () => {
    const html = renderToString(
      <ToastProvider>
        <DoubleEntryLedgerView />
      </ToastProvider>
    );

    expect(html).toContain("double-entry-finance-view");
    expect(html).toContain("Double-Entry Accounting Core · PRD §3.13");
    expect(html).toContain("Financial Ledger &amp; Settlement Reconciler");
    expect(html).toContain("btn-export-mushak");
    expect(html).toContain("btn-export-trial-balance");
    expect(html).toContain("Export Mushak 6.3 (VAT)");
    expect(html).toContain("Export Trial Balance");

    // Main 3 navigation tabs
    expect(html).toContain("tab-general-ledger");
    expect(html).toContain("tab-courier-reconciler");
    expect(html).toContain("tab-trial-balance");
  });

  it("renders General Ledger Explorer with balanced T-accounts and account filters", () => {
    const html = renderToString(
      <ToastProvider>
        <DoubleEntryLedgerView initialTab="LEDGER" />
      </ToastProvider>
    );

    expect(html).toContain("general-ledger-explorer");
    expect(html).toContain("ledger-search-input");
    expect(html).toContain("account-filter-select");

    // Journal Entry 1 (Customer Advance)
    expect(html).toContain("JRN-2026-00142");
    expect(html).toContain("NCA-2026-84920");
    expect(html).toContain("Balanced: Debits == Credits");
    expect(html).toContain("1100"); // SSLCommerz Clearing
    expect(html).toContain("2000"); // Customer Advances

    // Journal Entry 2 (Runner Sourcing Float Settlement)
    expect(html).toContain("JRN-2026-00141");
    expect(html).toContain("1200"); // Inventory - In Transit
    expect(html).toContain("1020"); // Cash - Runner Float

    // Journal Entry 3 (Delivery & VAT)
    expect(html).toContain("JRN-2026-00139");
    expect(html).toContain("2100"); // VAT Payable (Mushak 6.3)
    expect(html).toContain("4000"); // Revenue - Retail Sales
  });

  it("renders Courier Settlement Reconciler with batch remittance details and overdue flags", () => {
    const html = renderToString(
      <ToastProvider>
        <DoubleEntryLedgerView initialTab="COURIER_RECONCILER" />
      </ToastProvider>
    );

    expect(html).toContain("courier-settlement-reconciler");
    expect(html).toContain("Courier COD Bank Remittance Matching");

    // Batches
    expect(html).toContain("REM-PTH-2026-1027");
    expect(html).toContain("Pathao Courier");
    expect(html).toContain("Net Bank Remitted:");

    // Overdue parcel detection
    expect(html).toContain("status-unreconciled-overdue");
    expect(html).toContain("UNRECONCILED (&gt;7d Overdue)");
    expect(html).toContain("days");
    expect(html).toContain("btn-reconcile-batch-REMIT-STF-002");
  });

  it("renders Trial Balance Validator with balanced summary across assets, liabilities, and equity", () => {
    const html = renderToString(
      <ToastProvider>
        <DoubleEntryLedgerView initialTab="TRIAL_BALANCE" />
      </ToastProvider>
    );

    expect(html).toContain("trial-balance-validator");
    expect(html).toContain("Trial Balance (General Ledger Summary)");
    expect(html).toContain("Trial Balance Balanced (Debits == Credits)");

    // Accounts in Trial Balance
    expect(html).toContain("1000");
    expect(html).toContain("Office");
    expect(html).toContain("1020");
    expect(html).toContain("Runner Float");
    expect(html).toContain("1110");
    expect(html).toContain("Courier COD Receivable");
    expect(html).toContain("2100");
    expect(html).toContain("VAT Payable (Mushak 6.3)");
    expect(html).toContain("Total General Ledger Balances:");
  });
});
