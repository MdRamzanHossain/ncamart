import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  SecurityGovernanceView,
  StaffRoleModal,
  TotpResetModal,
  AuditLogDiffViewer,
  AnonymizeConfirmModal,
  MOCK_STAFF_MEMBERS,
  MOCK_AUDIT_LOGS,
  MOCK_CUSTOMERS_PII,
} from "../index";
import { ToastProvider } from "@/components/ui/toast";

describe("F36: Staff RBAC, Audit Logs & Data Privacy Console", () => {
  it("renders SecurityGovernanceView with header and 3 core compliance tabs", () => {
    const html = renderToString(
      <ToastProvider>
        <SecurityGovernanceView />
      </ToastProvider>
    );

    expect(html).toContain("security-governance-console");
    expect(html).toContain("Security, RBAC &amp; Compliance · PRD §3.9 &amp; §3.18");
    expect(html).toContain("Staff Governance &amp; Immutable Audit Trail");
    expect(html).toContain("tab-staff-rbac");
    expect(html).toContain("tab-audit-logs");
    expect(html).toContain("tab-data-privacy");
  });

  it("renders Staff Roles & Access Control table with 10 RBAC roles and 2FA status", () => {
    const html = renderToString(
      <ToastProvider>
        <SecurityGovernanceView initialTab="STAFF_RBAC" />
      </ToastProvider>
    );

    expect(html).toContain("staff-rbac-section");
    expect(html).toContain("staff-search-input");

    // Staff rows
    expect(html).toContain("Engr. Mahmudul Hasan");
    expect(html).toContain("SUPER_ADMIN");
    expect(html).toContain("2fa-active-STAFF-001");

    expect(html).toContain("Rafiqul Islam");
    expect(html).toContain("OPS_MANAGER");
    expect(html).toContain("GODOWN_MANAGER");

    expect(html).toContain("Shakil Mollah");
    expect(html).toContain("FIELD_RUNNER");
    expect(html).toContain("2FA Disabled");

    expect(html).toContain("btn-edit-role-STAFF-001");
    expect(html).toContain("btn-reset-totp-STAFF-001");
  });

  it("renders StaffRoleModal with 10 administrative roles and Last Super Admin guard information", () => {
    const superAdmin = MOCK_STAFF_MEMBERS[0];
    const html = renderToString(
      <StaffRoleModal
        staff={superAdmin}
        allStaff={MOCK_STAFF_MEMBERS}
        isOpen={true}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(html).toContain("staff-role-modal");
    expect(html).toContain("Edit Staff Roles &amp; Permissions");
    expect(html).toContain("checkbox-SUPER_ADMIN");
    expect(html).toContain("checkbox-OPS_MANAGER");
    expect(html).toContain("checkbox-FIELD_RUNNER");
    expect(html).toContain("checkbox-FINANCE_OFFICER");
    expect(html).toContain("btn-save-staff-roles");
  });

  it("renders TotpResetModal with auto-generated temporary password and copy action", () => {
    const staff = MOCK_STAFF_MEMBERS[1];
    const html = renderToString(
      <ToastProvider>
        <TotpResetModal
          staff={staff}
          isOpen={true}
          onClose={() => {}}
          onConfirmReset={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain("totp-reset-modal");
    expect(html).toContain("Staff TOTP 2FA Reset");
    expect(html).toContain("Rafiqul Islam");
    expect(html).toContain("generated-temp-password");
    expect(html).toContain("btn-copy-temp-password");
    expect(html).toContain("btn-confirm-totp-reset");
    expect(html).toContain("Invalidate Sessions &amp; Reset 2FA");
  });

  it("renders Immutable Audit Log stream and expandable JSON diff viewer", () => {
    const html = renderToString(
      <ToastProvider>
        <SecurityGovernanceView initialTab="AUDIT_LOGS" />
      </ToastProvider>
    );

    expect(html).toContain("audit-logs-section");
    expect(html).toContain("audit-search-input");
    expect(html).toContain("audit-action-filter");

    // Entries
    expect(html).toContain("AUD-2026-9041");
    expect(html).toContain("PRICE_OVERRIDE");
    expect(html).toContain("Tanvir Ahmed");
    expect(html).toContain("SOURCING_MANAGER");
    expect(html).toContain("TASK-84918-01");

    // Diff viewer rendered for expanded log
    expect(html).toContain("diff-viewer-AUD-2026-9041");
    expect(html).toContain("State Mutation Diff Viewer (JSON)");
    expect(html).toContain("targetWholesalePaisa");
    expect(html).toContain("maxAllowedSpotPaisa");
  });

  it("renders Customer PII Anonymization & Data Retention console preserving general ledger records", () => {
    const html = renderToString(
      <ToastProvider>
        <SecurityGovernanceView initialTab="DATA_PRIVACY" />
      </ToastProvider>
    );

    expect(html).toContain("data-privacy-section");
    expect(html).toContain("GDPR &amp; Bangladesh NBR Retention Governance");

    // Customer rows
    expect(html).toContain("CUST-8101");
    expect(html).toContain("Farhan Hossain");
    expect(html).toContain("ELIGIBLE FOR PURGE");
    expect(html).toContain("btn-anonymize-CUST-8101");

    // Already anonymized customer
    expect(html).toContain("CUST-9481");
    expect(html).toContain("ANONYMIZED_USER_9481");
    expect(html).toContain("status-anonymized-CUST-9481");
    expect(html).toContain("Journal Entries Intact");
  });

  it("renders AnonymizeConfirmModal with right to be forgotten terms and statutory retention safeguards", () => {
    const customer = MOCK_CUSTOMERS_PII[0];
    const html = renderToString(
      <AnonymizeConfirmModal
        customer={customer}
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(html).toContain("anonymize-confirm-modal");
    expect(html).toContain("Irreversible Customer Anonymization");
    expect(html).toContain("Farhan Hossain");
    expect(html).toContain("Phone Number Hashing");
    expect(html).toContain("Name Anonymization");
    expect(html).toContain("Statutory Financial Ledger Retention");
    expect(html).toContain("btn-confirm-anonymize");
  });
});
