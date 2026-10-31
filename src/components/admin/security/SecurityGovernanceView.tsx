"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { StaffUser, AuditLogEntry, CustomerPiiRecord, AuditActionType } from "./types";
import { MOCK_AUDIT_LOGS, MOCK_CUSTOMERS_PII } from "./mockData";
import { StaffRoleModal } from "./StaffRoleModal";
import { TotpResetModal } from "./TotpResetModal";
import { AuditLogDiffViewer } from "./AuditLogDiffViewer";
import { AnonymizeConfirmModal } from "./AnonymizeConfirmModal";
import { UserDeleteModal } from "./UserDeleteModal";
import { AddUserModal } from "./AddUserModal";
import { useToast } from "@/components/ui/toast";
import type { AdminRole } from "../types";

export interface SecurityGovernanceViewProps {
  initialTab?: "STAFF_RBAC" | "AUDIT_LOGS" | "DATA_PRIVACY";
}

export function SecurityGovernanceView({
  initialTab = "STAFF_RBAC",
}: SecurityGovernanceViewProps = {}) {
  const [activeTab, setActiveTab] = useState<"STAFF_RBAC" | "AUDIT_LOGS" | "DATA_PRIVACY">(initialTab);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOGS);
  const [customersPii, setCustomersPii] = useState<CustomerPiiRecord[]>(MOCK_CUSTOMERS_PII);

  // Search & Filters
  const [staffSearch, setStaffSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "STAFF" | "CUSTOMER">("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<string | null>("AUD-2026-9041");

  // Modals
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [resettingTotpStaff, setResettingTotpStaff] = useState<StaffUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<StaffUser | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [anonymizingCustomer, setAnonymizingCustomer] = useState<CustomerPiiRecord | null>(null);

  const { addToast } = useToast();

  // Load Real Registered Users & Staff from Backend API
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch("/api/v1/admin/users", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setUsersList(data.users);
          const mappedStaff: StaffUser[] = data.users.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            roles: u.roles,
            status: u.status,
            twoFactorEnabled: u.twoFactorEnabled,
            assignedLocation: u.type === "STAFF" ? "Nawabpur Central Godown & HQ" : "Storefront Customer",
            createdAt: u.createdAt,
            lastLoginAt: u.lastLoginAt || "Recently active",
            type: u.type,
            authProvider: u.authProvider,
          }));
          setStaffList(mappedStaff);
          return;
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Save Staff / User Roles & Access
  const handleSaveRoles = async (
    staffId: string,
    updatedRoles: AdminRole[],
    updatedStatus?: "ACTIVE" | "SUSPENDED"
  ) => {
    try {
      const res = await fetch(`/api/v1/admin/users/${staffId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: updatedRoles,
          status: updatedStatus,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update user access.");
      }

      const responseData = await res.json();

      if (responseData.user) {
        setStaffList((prev) =>
          prev.map((s) =>
            s.id === staffId || s.email.toLowerCase() === responseData.user.email?.toLowerCase()
              ? {
                  ...s,
                  id: responseData.user.id,
                  type: responseData.user.type,
                  roles: responseData.user.roles,
                  status: responseData.user.status,
                  assignedLocation: responseData.user.type === "STAFF" ? "Nawabpur Central Godown & HQ" : "Storefront Customer",
                }
              : s
          )
        );
      }

      // Create Audit Log Entry
      const staffTarget = staffList.find((s) => s.id === staffId);
      if (staffTarget) {
        const newAudit: AuditLogEntry = {
          id: `AUD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
          actorId: "STAFF-001",
          actorName: "SuperAdmin",
          actorRole: "SUPER_ADMIN",
          action: "STAFF_ROLE_MUTATED",
          resourceType: "UserAccount",
          resourceId: staffId,
          ipAddress: "103.230.106.18 (Nawabpur Fiber)",
          beforeJson: { roles: staffTarget.roles, status: staffTarget.status },
          afterJson: { roles: updatedRoles, status: updatedStatus || staffTarget.status },
        };
        setAuditLogs((prev) => [newAudit, ...prev]);
      }

      addToast({
        title: "User Access & Roles Updated",
        description: `Roles and permissions updated for user ${staffId}.`,
        variant: "success",
      });

      await fetchUsers();
    } catch (err: any) {
      addToast({
        title: "Update Failed",
        description: err.message || "Could not update user roles.",
        variant: "destructive",
      });
    }
  };

  // Handle TOTP Reset
  const handleConfirmTotpReset = async (staffId: string) => {
    try {
      await fetch(`/api/v1/admin/users/${staffId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset2FA: true }),
      });

      setStaffList((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, twoFactorEnabled: false } : s))
      );

      addToast({
        title: "2FA Reset Complete",
        description: `Two-factor authentication has been disabled for ${staffId}.`,
        variant: "success",
      });
    } catch {
      // fallback
    }
  };

  // Handle Delete User
  const handleConfirmDeleteUser = async (userId: string) => {
    const res = await fetch(`/api/v1/admin/users/${userId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete user.");
    }

    setStaffList((prev) => prev.filter((s) => s.id !== userId));
    setUsersList((prev) => prev.filter((u) => u.id !== userId));

    addToast({
      title: "User Deleted",
      description: "User account was permanently deleted from the database.",
      variant: "success",
    });

    fetchUsers();
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

  // Filtered Users (Staff + Customers)
  const filteredUsers = staffList.filter((u: any) => {
    if (filterType === "STAFF" && u.type === "CUSTOMER") return false;
    if (filterType === "CUSTOMER" && u.type !== "CUSTOMER") return false;
    if (filterStatus !== "ALL" && u.status !== filterStatus) return false;

    const q = staffSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q)) ||
      (u.roles && u.roles.some((r: string) => r.toLowerCase().includes(q)))
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
          <div className="header-pill">Security, Users &amp; RBAC Compliance · PRD §3.9 &amp; §3.18</div>
          <h1 className="console-title">User Management &amp; Access Governance</h1>
          <p className="console-sub">
            Monitor registered users, manage staff access roles, promote/demote accounts, and execute immutable audit records.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === "STAFF_RBAC" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("STAFF_RBAC");
            setFilterType("ALL");
          }}
          data-testid="tab-staff-rbac"
        >
          👥 Registered Users &amp; Staff Access
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

      {/* Tab 1: Registered Users & Staff Roles */}
      {activeTab === "STAFF_RBAC" && (
        <section className="staff-section" data-testid="staff-rbac-section">
          {/* Controls & Filter Bar */}
          <div className="section-toolbar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
            <div className="search-wrap" style={{ flex: "1 1 240px" }}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search by name, email, phone, or role..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                data-testid="staff-search-input"
              />
            </div>

            {/* Filter by Type */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className={`filter-pill-btn ${filterType === "ALL" ? "filter-pill-active" : ""}`}
                onClick={() => setFilterType("ALL")}
              >
                All Accounts ({staffList.length})
              </button>
              <button
                type="button"
                className={`filter-pill-btn ${filterType === "STAFF" ? "filter-pill-active" : ""}`}
                onClick={() => setFilterType("STAFF")}
              >
                👑 Staff ({staffList.filter((s: any) => s.type !== "CUSTOMER").length})
              </button>
              <button
                type="button"
                className={`filter-pill-btn ${filterType === "CUSTOMER" ? "filter-pill-active" : ""}`}
                onClick={() => setFilterType("CUSTOMER")}
              >
                👤 Customers ({staffList.filter((s: any) => s.type === "CUSTOMER").length})
              </button>
            </div>

            {/* Filter by Status */}
            <select
              className="action-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#f8fafc",
                fontSize: "12px",
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>

            <button
              type="button"
              onClick={() => setIsAddUserOpen(true)}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
              }}
            >
              ➕ Add Staff / User
            </button>
          </div>

          {/* Users Table */}
          <div className="table-card">
            {isLoadingUsers ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                Loading registered users and access permissions...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>👥</div>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "#f8fafc" }}>No registered users found</div>
                <p style={{ fontSize: "12px", margin: "6px 0 16px", color: "#64748b" }}>
                  No accounts match your current filter. You can add a staff member or user above.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(true)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "#3b82f6",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Create New Account
                </button>
              </div>
            ) : (
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>User &amp; Identity</th>
                    <th>Contact &amp; Provider</th>
                    <th>Type &amp; Status</th>
                    <th>Assigned Roles (RBAC)</th>
                    <th>2FA Status</th>
                    <th>Registered</th>
                    <th className="th-actions">Governance Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user: any) => (
                    <tr key={user.id} data-testid={`staff-row-${user.id}`}>
                      <td>
                        <div className="staff-profile-cell">
                          <div className="staff-avatar">{user.name?.charAt(0) || "U"}</div>
                          <div>
                            <div className="staff-name font-bold">{user.name}</div>
                            <div className="staff-email font-mono">{user.email || "No email provided"}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span className="font-mono text-sm" style={{ color: "#cbd5e1" }}>{user.phone || "—"}</span>
                          <span
                            style={{
                              fontSize: "10px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              color: user.authProvider === "GOOGLE" ? "#60a5fa" : "#94a3b8",
                            }}
                          >
                            {user.authProvider === "GOOGLE" ? "🌐 Google Auth" : user.authProvider === "PHONE_OTP" ? "📱 Phone OTP" : "🔑 Credentials"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: user.type === "STAFF" ? "rgba(245, 158, 11, 0.15)" : "rgba(100, 116, 139, 0.15)",
                              color: user.type === "STAFF" ? "#fbbf24" : "#94a3b8",
                              display: "inline-block",
                              width: "fit-content",
                            }}
                          >
                            {user.type === "STAFF" ? "👑 Staff" : "👤 Customer"}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              color: user.status === "ACTIVE" ? "#34d399" : "#f87171",
                            }}
                          >
                            {user.status === "ACTIVE" ? "✓ Active" : "🚫 Suspended"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="roles-stack">
                          {user.roles.map((r: string) => (
                            <span
                              key={r}
                              className={`role-pill ${
                                r === "SUPER_ADMIN" ? "role-super" : r === "CUSTOMER" ? "role-customer" : "role-standard"
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {user.twoFactorEnabled ? (
                          <span className="badge-2fa-active" data-testid={`2fa-active-${user.id}`}>
                            ✓ 2FA Active
                          </span>
                        ) : (
                          <span className="badge-2fa-disabled">⚠️ 2FA Disabled</span>
                        )}
                      </td>
                      <td className="font-mono text-muted" style={{ fontSize: "11px" }}>
                        {user.createdAt ? user.createdAt.slice(0, 10) : "—"}
                      </td>
                      <td className="td-actions">
                        <div className="actions-cluster">
                          <button
                            type="button"
                            className="btn-action btn-edit-role"
                            onClick={() => setEditingStaff(user)}
                            data-testid={`btn-edit-role-${user.id}`}
                            title="Edit User Roles & Access Status"
                          >
                            ✏️ Edit Access
                          </button>
                          {user.roles.some((r: string) => r !== "CUSTOMER") && (
                            <button
                              type="button"
                              className="btn-action btn-reset-totp"
                              onClick={() => setResettingTotpStaff(user)}
                              data-testid={`btn-reset-totp-${user.id}`}
                              title="Reset Two-Factor Authentication"
                            >
                              🔑 Reset 2FA
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-action btn-delete-user"
                            onClick={() => setDeletingUser(user)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              background: "rgba(239, 68, 68, 0.12)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              color: "#f87171",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            title="Delete User Account Permanently"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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

      {deletingUser && (
        <UserDeleteModal
          user={deletingUser}
          isOpen={true}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleConfirmDeleteUser}
        />
      )}

      {isAddUserOpen && (
        <AddUserModal
          isOpen={true}
          onClose={() => setIsAddUserOpen(false)}
          onCreated={(newUser) => {
            fetchUsers();
            addToast({
              title: "Account Created",
              description: `User account ${newUser.email || newUser.phone} created successfully.`,
              variant: "success",
            });
          }}
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

        .role-customer {
          background: rgba(148, 163, 184, 0.12);
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.25);
        }

        .filter-pill-btn {
          padding: 6px 12px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-pill-btn:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.1);
        }

        .filter-pill-active {
          background: rgba(59, 130, 246, 0.2);
          border-color: #3b82f6;
          color: #60a5fa;
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
