"use client";

import React, { useState } from "react";
import type { StaffUser, AuditLogEntry, CustomerPiiRecord, AuditActionType } from "./types";
import { MOCK_STAFF_MEMBERS, MOCK_AUDIT_LOGS, MOCK_CUSTOMERS_PII } from "./mockData";
import { StaffRoleModal } from "./StaffRoleModal";
import { TotpResetModal } from "./TotpResetModal";
import { AuditLogDiffViewer } from "./AuditLogDiffViewer";
import { AnonymizeConfirmModal } from "./AnonymizeConfirmModal";
import { useToast } from "@/components/ui/toast";
import type { AdminRole } from "../types";

export interface SecurityGovernanceViewProps {
  initialTab?: "STAFF_RBAC" | "AUDIT_LOGS" | "DATA_PRIVACY";
}

export function SecurityGovernanceView({
  initialTab = "STAFF_RBAC",
}: SecurityGovernanceViewProps = {}) {
  const [activeTab, setActiveTab] = useState<"STAFF_RBAC" | "AUDIT_LOGS" | "DATA_PRIVACY">(initialTab);
  const [staffList, setStaffList] = useState<StaffUser[]>(MOCK_STAFF_MEMBERS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOGS);
  const [customersPii, setCustomersPii] = useState<CustomerPiiRecord[]>(MOCK_CUSTOMERS_PII);

  // Search & Filters
  const [staffSearch, setStaffSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<string | null>("AUD-2026-9041");

  // Modals
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [resettingTotpStaff, setResettingTotpStaff] = useState<StaffUser | null>(null);
  const [anonymizingCustomer, setAnonymizingCustomer] = useState<CustomerPiiRecord | null>(null);

  const { addToast } = useToast();

  // Handle Save Staff Roles
  const handleSaveRoles = (staffId: string, updatedRoles: AdminRole[]) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, roles: updatedRoles } : s))
    );

    // Create Audit Log Entry
    const staffTarget = staffList.find((s) => s.id === staffId);
    if (staffTarget) {
      const newAudit: AuditLogEntry = {
        id: `AUD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        actorId: "STAFF-001",
        actorName: "Engr. Mahmudul Hasan",
        actorRole: "SUPER_ADMIN",
        action: "STAFF_ROLE_MUTATED",
        resourceType: "StaffAccount",
        resourceId: staffId,
        ipAddress: "103.230.106.18 (Nawabpur Fiber)",
        beforeJson: { roles: staffTarget.roles },
        afterJson: { roles: updatedRoles },
      };
      setAuditLogs((prev) => [newAudit, ...prev]);
    }

    addToast({
      title: "Staff Roles Updated",
      description: `Roles updated for staff ${staffId}. Changes will take effect on their next action.`,
      variant: "success",
    });
  };

  // Handle TOTP Reset
  const handleConfirmTotpReset = (staffId: string) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, twoFactorEnabled: false } : s))
    );
  };

  // Handle Customer Anonymization
  const handleConfirmAnonymize = (customerId: string) => {
    const custTarget = customersPii.find((c) => c.id === customerId);
    if (!custTarget) return;

    const shortId = customerId.replace("CUST-", "");
    const updatedRecord: CustomerPiiRecord = {
      ...custTarget,
      name: `ANONYMIZED_USER_${shortId}`,
      phone: `sha256:${Math.random().toString(36).substring(2, 15)}...`,
      email: `anonymized_${shortId}@privacy.ncamart.internal`,
      city: "[REDACTED]",
      division: "[REDACTED]",
      retentionStatus: "ANONYMIZED",
    };

    setCustomersPii((prev) =>
      prev.map((c) => (c.id === customerId ? updatedRecord : c))
    );

    // Add Audit Log
    const newAudit: AuditLogEntry = {
      id: `AUD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      actorId: "STAFF-001",
      actorName: "Engr. Mahmudul Hasan",
      actorRole: "SUPER_ADMIN",
      action: "CUSTOMER_ANONYMIZED",
      resourceType: "CustomerUser",
      resourceId: customerId,
      ipAddress: "103.230.106.18 (Nawabpur Fiber)",
      beforeJson: {
        name: custTarget.name,
        phone: custTarget.phone,
        email: custTarget.email,
      },
      afterJson: {
        name: updatedRecord.name,
        phone: updatedRecord.phone,
        email: updatedRecord.email,
        financialLedgerRetained: true,
      },
    };
    setAuditLogs((prev) => [newAudit, ...prev]);

    setAnonymizingCustomer(null);
    addToast({
      title: "Customer PII Cryptographically Anonymized",
      description: `Customer ${customerId} personal records redacted. ${custTarget.journalEntriesCount} financial ledger entries preserved intact.`,
      variant: "default",
    });
  };

  // Filtered Staff
  const filteredStaff = staffList.filter((s) => {
    const q = staffSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.roles.some((r) => r.toLowerCase().includes(q))
    );
  });

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const q = auditSearch.toLowerCase();
    const matchesSearch =
      log.actorName.toLowerCase().includes(q) ||
      log.resourceId.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.id.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (auditActionFilter !== "ALL" && log.action !== auditActionFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="security-console" data-testid="security-governance-console">
      {/* Header */}
      <div className="console-header">
        <div>
          <div className="header-pill">Security, RBAC &amp; Compliance · PRD §3.9 &amp; §3.18</div>
          <h1 className="console-title">Staff Governance &amp; Immutable Audit Trail</h1>
          <p className="console-sub">
            Granular access control across 10 staff roles, cryptographic audit logs, and GDPR customer data retention.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === "STAFF_RBAC" ? "active" : ""}`}
          onClick={() => setActiveTab("STAFF_RBAC")}
          data-testid="tab-staff-rbac"
        >
          👥 Staff Roles &amp; Access Control
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "AUDIT_LOGS" ? "active" : ""}`}
          onClick={() => setActiveTab("AUDIT_LOGS")}
          data-testid="tab-audit-logs"
        >
          📜 Immutable Audit Log Stream
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "DATA_PRIVACY" ? "active" : ""}`}
          onClick={() => setActiveTab("DATA_PRIVACY")}
          data-testid="tab-data-privacy"
        >
          🔒 Customer PII &amp; Data Retention
        </button>
      </div>

      {/* Tab 1: Staff Roles & Access Control */}
      {activeTab === "STAFF_RBAC" && (
        <section className="staff-section" data-testid="staff-rbac-section">
          {/* Controls */}
          <div className="section-toolbar">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search staff by name, email, or role..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                data-testid="staff-search-input"
              />
            </div>
            <div className="staff-count font-mono">
              Total Active Staff: <strong>{staffList.length}</strong>
            </div>
          </div>

          {/* Staff Table */}
          <div className="table-card">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Assigned Location</th>
                  <th>Assigned Roles (RBAC)</th>
                  <th>2FA Status</th>
                  <th>Last Active</th>
                  <th className="th-actions">Governance Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} data-testid={`staff-row-${staff.id}`}>
                    <td>
                      <div className="staff-profile-cell">
                        <div className="staff-avatar">{staff.name.charAt(0)}</div>
                        <div>
                          <div className="staff-name font-bold">{staff.name}</div>
                          <div className="staff-email font-mono">{staff.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="location-pill">{staff.assignedLocation}</span>
                    </td>
                    <td>
                      <div className="roles-stack">
                        {staff.roles.map((r) => (
                          <span
                            key={r}
                            className={`role-pill ${
                              r === "SUPER_ADMIN" ? "role-super" : "role-standard"
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {staff.twoFactorEnabled ? (
                        <span className="badge-2fa-active" data-testid={`2fa-active-${staff.id}`}>
                          ✓ 2FA Active (TOTP)
                        </span>
                      ) : (
                        <span className="badge-2fa-disabled">⚠️ 2FA Disabled</span>
                      )}
                    </td>
                    <td className="font-mono text-muted">{staff.lastLoginAt}</td>
                    <td className="td-actions">
                      <div className="actions-cluster">
                        <button
                          type="button"
                          className="btn-action btn-edit-role"
                          onClick={() => setEditingStaff(staff)}
                          data-testid={`btn-edit-role-${staff.id}`}
                        >
                          ✏️ Edit Roles
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-reset-totp"
                          onClick={() => setResettingTotpStaff(staff)}
                          data-testid={`btn-reset-totp-${staff.id}`}
                        >
                          🔑 Reset 2FA
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Immutable Audit Log Stream */}
      {activeTab === "AUDIT_LOGS" && (
        <section className="audit-section" data-testid="audit-logs-section">
          {/* Controls */}
          <div className="section-toolbar">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search audit trail by actor, action, or resource ID..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                data-testid="audit-search-input"
              />
            </div>

            <div className="filter-wrap">
              <label htmlFor="audit-action-filter" className="filter-lbl">Action Filter:</label>
              <select
                id="audit-action-filter"
                className="action-select"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                data-testid="audit-action-filter"
              >
                <option value="ALL">All Actions (Full Trail)</option>
                <option value="PRICE_OVERRIDE">PRICE_OVERRIDE (Runner)</option>
                <option value="SEAL_VOID">SEAL_VOID (QC Station)</option>
                <option value="REFUND_ISSUED">REFUND_ISSUED (RMA Support)</option>
                <option value="CUSTOMER_ANONYMIZED">CUSTOMER_ANONYMIZED (Privacy)</option>
                <option value="STAFF_ROLE_MUTATED">STAFF_ROLE_MUTATED (RBAC)</option>
                <option value="TOTP_2FA_RESET">TOTP_2FA_RESET (Auth)</option>
              </select>
            </div>
          </div>

          {/* Audit Stream Stack */}
          <div className="audit-stack">
            {filteredAuditLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="audit-card" data-testid={`audit-entry-${log.id}`}>
                  <div className="audit-card-top">
                    <div className="audit-actor-meta">
                      <span className="log-id font-mono">{log.id}</span>
                      <span className={`action-tag action-${log.action.toLowerCase()}`}>
                        {log.action}
                      </span>
                      <span className="actor-name font-bold">{log.actorName}</span>
                      <span className="actor-role-badge font-mono">{log.actorRole}</span>
                      <span className="log-time font-mono">{log.timestamp}</span>
                    </div>

                    <button
                      type="button"
                      className="btn-toggle-diff"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      data-testid={`btn-toggle-diff-${log.id}`}
                    >
                      {isExpanded ? "▲ Hide State Diff" : "▼ View State Diff (JSON)"}
                    </button>
                  </div>

                  <div className="audit-target-row">
                    <span className="target-lbl">Target:</span>
                    <span className="target-val font-mono">
                      {log.resourceType} · <strong>{log.resourceId}</strong>
                    </span>
                    <span className="ip-val font-mono">Via: {log.ipAddress}</span>
                  </div>

                  {isExpanded && <AuditLogDiffViewer entry={log} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tab 3: Customer PII & Data Retention */}
      {activeTab === "DATA_PRIVACY" && (
        <section className="privacy-section" data-testid="data-privacy-section">
          <div className="privacy-intro">
            <div>
              <h2 className="section-title">GDPR &amp; Bangladesh NBR Retention Governance</h2>
              <p className="section-sub">
                Execute customer Right to be Forgotten by irreversibly hashing personal data while retaining immutable double-entry general ledger transactions per PRD §3.18 &amp; DECISIONS.md #64.
              </p>
            </div>
          </div>

          <div className="table-card">
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Customer ID</th>
                  <th>Customer Name &amp; Contact</th>
                  <th>City / Division</th>
                  <th>Orders</th>
                  <th>Ledger Records</th>
                  <th>Retention Status</th>
                  <th className="th-actions">Privacy Action</th>
                </tr>
              </thead>
              <tbody>
                {customersPii.map((cust) => (
                  <tr key={cust.id} data-testid={`customer-row-${cust.id}`}>
                    <td className="font-mono">{cust.id}</td>
                    <td>
                      <div>
                        <div className="font-bold">{cust.name}</div>
                        <div className="font-mono text-muted text-sm">{cust.phone}</div>
                        <div className="font-mono text-muted text-sm">{cust.email}</div>
                      </div>
                    </td>
                    <td>{cust.city}</td>
                    <td className="font-mono">{cust.totalOrders}</td>
                    <td>
                      <span className="ledger-count font-mono" data-testid={`ledger-count-${cust.id}`}>
                        ⚖️ {cust.journalEntriesCount} Journal Entries Intact
                      </span>
                    </td>
                    <td>
                      {cust.retentionStatus === "ANONYMIZED" && (
                        <span className="badge-anonymized" data-testid={`status-anonymized-${cust.id}`}>
                          🔒 ANONYMIZED
                        </span>
                      )}
                      {cust.retentionStatus === "ELIGIBLE_FOR_PURGE" && (
                        <span className="badge-eligible">
                          ⏳ ELIGIBLE FOR PURGE
                        </span>
                      )}
                      {cust.retentionStatus === "ACTIVE_RETENTION" && (
                        <span className="badge-active">
                          ✓ ACTIVE (Within Window)
                        </span>
                      )}
                    </td>
                    <td className="td-actions">
                      {cust.retentionStatus !== "ANONYMIZED" ? (
                        <button
                          type="button"
                          className="btn-anonymize"
                          onClick={() => setAnonymizingCustomer(cust)}
                          data-testid={`btn-anonymize-${cust.id}`}
                        >
                          🔒 Anonymize PII
                        </button>
                      ) : (
                        <span className="text-muted text-sm font-bold">Immutable Retained</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modals */}
      {editingStaff && (
        <StaffRoleModal
          staff={editingStaff}
          allStaff={staffList}
          isOpen={true}
          onClose={() => setEditingStaff(null)}
          onSave={handleSaveRoles}
        />
      )}

      {resettingTotpStaff && (
        <TotpResetModal
          staff={resettingTotpStaff}
          isOpen={true}
          onClose={() => setResettingTotpStaff(null)}
          onConfirmReset={handleConfirmTotpReset}
        />
      )}

      {anonymizingCustomer && (
        <AnonymizeConfirmModal
          customer={anonymizingCustomer}
          isOpen={true}
          onClose={() => setAnonymizingCustomer(null)}
          onConfirm={handleConfirmAnonymize}
        />
      )}

      <style jsx>{`
        .security-console {
          display: flex;
          flex-direction: column;
          gap: 20px;
          color: #f8fafc;
        }

        .console-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: #0b1329;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 24px;
        }

        .header-pill {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          color: #38bdf8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }

        .console-title {
          font-size: 22px;
          font-weight: 900;
          margin: 0 0 6px 0;
          color: #f8fafc;
        }

        .console-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .tabs-bar {
          display: flex;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 8px;
        }

        .tab-btn {
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          background: transparent;
          border: 1px solid transparent;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab-btn:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.04);
        }

        .tab-btn.active {
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.1);
          border-color: rgba(56, 189, 248, 0.3);
        }

        .section-toolbar {
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
          gap: 10px;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 14px;
          min-width: 340px;
        }

        .search-icon {
          font-size: 14px;
        }

        .search-input {
          background: transparent;
          border: none;
          color: #f8fafc;
          font-size: 13px;
          width: 100%;
          outline: none;
        }

        .staff-count {
          font-size: 12px;
          color: #94a3b8;
        }

        .filter-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .filter-lbl {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 700;
        }

        .action-select {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #f8fafc;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          outline: none;
        }

        .table-card {
          background: #0b1329;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow-x: auto;
        }

        .staff-table,
        .privacy-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          text-align: left;
        }

        .staff-table th,
        .privacy-table th {
          background: #0f172a;
          color: #94a3b8;
          font-weight: 700;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .staff-table td,
        .privacy-table td {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          vertical-align: middle;
        }

        .staff-profile-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .staff-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #38bdf8;
          color: #032135;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 14px;
        }

        .staff-name {
          color: #f8fafc;
        }

        .staff-email {
          color: #64748b;
          font-size: 11px;
        }

        .location-pill {
          font-size: 11px;
          color: #cbd5e1;
        }

        .roles-stack {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .role-pill {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }

        .role-super {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.4);
        }

        .role-standard {
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
        }

        .badge-2fa-active {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 9999px;
        }

        .badge-2fa-disabled {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 9999px;
        }

        .actions-cluster {
          display: flex;
          gap: 8px;
        }

        .btn-action {
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: #f8fafc;
          transition: all 0.15s ease;
        }

        .btn-action:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .btn-edit-role:hover {
          border-color: #38bdf8;
          color: #38bdf8;
        }

        .btn-reset-totp:hover {
          border-color: #f59e0b;
          color: #f59e0b;
        }

        /* Audit Stream */
        .audit-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .audit-card {
          background: #0b1329;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .audit-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .audit-actor-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .log-id {
          color: #64748b;
          font-size: 11px;
        }

        .action-tag {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 4px;
        }

        .action-price_override {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .action-seal_void {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .action-refund_issued {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .action-customer_anonymized {
          background: rgba(168, 85, 247, 0.2);
          color: #c084fc;
        }

        .action-staff_role_mutated,
        .action-totp_2fa_reset {
          background: rgba(56, 189, 248, 0.2);
          color: #38bdf8;
        }

        .actor-role-badge {
          font-size: 10px;
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .log-time {
          font-size: 11px;
          color: #64748b;
        }

        .btn-toggle-diff {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #38bdf8;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-toggle-diff:hover {
          background: rgba(56, 189, 248, 0.1);
        }

        .audit-target-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          color: #cbd5e1;
        }

        .target-lbl {
          color: #64748b;
        }

        .ip-val {
          margin-left: auto;
          color: #64748b;
        }

        /* Privacy */
        .privacy-intro {
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 4px 0;
          color: #f8fafc;
        }

        .section-sub {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
          max-width: 800px;
        }

        .ledger-count {
          color: #38bdf8;
          font-weight: 700;
          font-size: 11px;
        }

        .badge-anonymized {
          background: rgba(168, 85, 247, 0.2);
          color: #c084fc;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 9999px;
        }

        .badge-eligible {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 9999px;
        }

        .badge-active {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 9999px;
        }

        .btn-anonymize {
          padding: 6px 12px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          font-size: 11px;
          font-weight: 800;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-anonymize:hover {
          background: #dc2626;
          color: #fff;
        }

        .font-mono {
          font-family: monospace;
        }

        .font-bold {
          font-weight: 700;
        }

        .text-muted {
          color: #64748b;
        }

        .text-sm {
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
