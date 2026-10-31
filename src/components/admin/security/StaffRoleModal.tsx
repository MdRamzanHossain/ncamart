"use client";

import React, { useState } from "react";
import type { StaffUser } from "./types";
import { ALL_ADMIN_ROLES } from "./mockData";
import type { AdminRole } from "../types";

export interface StaffRoleModalProps {
  staff: StaffUser;
  allStaff: StaffUser[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (staffId: string, updatedRoles: AdminRole[], updatedStatus?: "ACTIVE" | "SUSPENDED") => void;
}

export function StaffRoleModal({
  staff,
  allStaff = [],
  isOpen,
  onClose,
  onSave,
}: StaffRoleModalProps) {
  if (!isOpen || !staff) return null;

  const isInitiallyCustomer =
    staff.type === "CUSTOMER" ||
    (staff.roles && staff.roles.length === 1 && staff.roles[0] === "CUSTOMER") ||
    !(staff.roles || []).some((r) => r !== "CUSTOMER");

  const [accountType, setAccountType] = useState<"CUSTOMER" | "STAFF">(
    isInitiallyCustomer ? "CUSTOMER" : "STAFF"
  );

  const initialStaffRoles = (staff.roles || []).filter((r) => r !== "CUSTOMER") as AdminRole[];
  const [selectedRoles, setSelectedRoles] = useState<AdminRole[]>(
    initialStaffRoles.length > 0 ? initialStaffRoles : ["SUPER_ADMIN"]
  );

  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED">(
    (staff.status as any) || "ACTIVE"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Last Super Admin Guard (DECISIONS.md #62 / PRD §3.9)
  const isTargetSuperAdmin = (staff.roles || []).includes("SUPER_ADMIN");
  const totalSuperAdmins = (allStaff || []).filter(
    (s) => s.status === "ACTIVE" && (s.roles || []).includes("SUPER_ADMIN")
  ).length;

  const toggleRole = (role: AdminRole) => {
    setErrorMsg(null);
    if (selectedRoles.includes(role)) {
      if (role === "SUPER_ADMIN" && isTargetSuperAdmin && totalSuperAdmins <= 1) {
        setErrorMsg(
          "Security Invariant Breach (PRD §3.9): Cannot revoke the last active SUPER_ADMIN role. At least one Super Admin is required to prevent system lockout."
        );
        return;
      }
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSave = () => {
    setErrorMsg(null);

    if (accountType === "CUSTOMER") {
      // Guard against demoting last super admin
      if (isTargetSuperAdmin && totalSuperAdmins <= 1) {
        setErrorMsg("Security Invariant Breach: Cannot demote the last active SUPER_ADMIN to Customer.");
        return;
      }
      onSave(staff.id, ["CUSTOMER" as any], status);
      onClose();
      return;
    }

    // Staff Member
    if (selectedRoles.length === 0) {
      setErrorMsg("Please select at least one Staff Role (e.g. Super Admin, Operations Manager).");
      return;
    }

    if (
      isTargetSuperAdmin &&
      !selectedRoles.includes("SUPER_ADMIN") &&
      totalSuperAdmins <= 1
    ) {
      setErrorMsg(
        "Security Invariant Breach: Cannot revoke the last active SUPER_ADMIN role."
      );
      return;
    }

    onSave(staff.id, selectedRoles, status);
    onClose();
  };

  return (
    <div className="modal-backdrop" data-testid="staff-role-modal">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-pill">Access &amp; Roles Governance</div>
            <h2 className="modal-title">Edit Staff Roles &amp; Permissions</h2>
            <p className="modal-sub">
              Configuring account for <strong>{staff.name}</strong> ({staff.email})
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} data-testid="btn-close-role-modal">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="alert-error" data-testid="role-guard-error">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Account Type Selector (Customer vs Staff) */}
        <div style={{ margin: "16px 24px 0 24px", padding: "12px 16px", background: "#0b1329", borderRadius: "10px", border: "1px solid #1e293b" }}>
          <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "8px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Account Governance Type
          </label>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              onClick={() => {
                setAccountType("STAFF");
                if (selectedRoles.length === 0) setSelectedRoles(["SUPER_ADMIN"]);
              }}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "8px",
                border: accountType === "STAFF" ? "2px solid #38bdf8" : "1px solid #334155",
                background: accountType === "STAFF" ? "rgba(56, 189, 248, 0.12)" : "#0f172a",
                color: accountType === "STAFF" ? "#38bdf8" : "#94a3b8",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>🛡️</span>
              <div>
                <div>Staff / Admin Member</div>
                <div style={{ fontSize: "11px", fontWeight: 400, opacity: 0.8 }}>Backoffice Access &amp; Operational Roles</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAccountType("CUSTOMER")}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "8px",
                border: accountType === "CUSTOMER" ? "2px solid #a855f7" : "1px solid #334155",
                background: accountType === "CUSTOMER" ? "rgba(168, 85, 247, 0.12)" : "#0f172a",
                color: accountType === "CUSTOMER" ? "#c084fc" : "#94a3b8",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>🛒</span>
              <div>
                <div>Storefront Customer</div>
                <div style={{ fontSize: "11px", fontWeight: 400, opacity: 0.8 }}>Orders, RMA, and Wallet Only</div>
              </div>
            </button>
          </div>
        </div>

        {/* Account Access Status */}
        <div style={{ margin: "12px 24px 0 24px", padding: "10px 16px", background: "#1e293b", borderRadius: "8px", border: "1px solid #334155" }}>
          <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "6px", fontWeight: 700, textTransform: "uppercase" }}>
            Account Access Status
          </label>
          <div style={{ display: "flex", gap: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#10b981", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="radio"
                name="accStatus"
                value="ACTIVE"
                checked={status === "ACTIVE"}
                onChange={() => setStatus("ACTIVE")}
              />
              ✓ Active (Full Access Permitted)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="radio"
                name="accStatus"
                value="SUSPENDED"
                checked={status === "SUSPENDED"}
                onChange={() => setStatus("SUSPENDED")}
              />
              🚫 Suspended (Login &amp; Orders Blocked)
            </label>
          </div>
        </div>

        {/* Roles list if Staff */}
        {accountType === "STAFF" ? (
          <div className="roles-list">
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", padding: "4px 0" }}>
              Assigned Operational &amp; Governance Roles
            </div>
            {ALL_ADMIN_ROLES.map(({ role, label, description }) => {
              const isChecked = selectedRoles.includes(role);
              return (
                <label
                  key={role}
                  className={`role-item ${isChecked ? "role-item-active" : ""}`}
                  data-testid={`role-option-${role}`}
                >
                  <input
                    type="checkbox"
                    className="role-checkbox"
                    checked={isChecked}
                    onChange={() => toggleRole(role)}
                    data-testid={`checkbox-${role}`}
                  />
                  <div className="role-info">
                    <div className="role-label-row">
                      <span className="role-name">{label}</span>
                      <span className="role-code font-mono">{role}</span>
                    </div>
                    <p className="role-desc">{description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "24px", color: "#94a3b8", fontSize: "13px", textAlign: "center", lineHeight: "1.6" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🛒</div>
            <strong style={{ color: "#f8fafc", display: "block", marginBottom: "4px" }}>Regular Customer Account</strong>
            This user has standard storefront privileges (placing orders, tracking consignments, warranty claims, and wallet balances). They do not have access to any Admin Backoffice modules.
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            data-testid="btn-save-staff-roles"
          >
            ✓ Save Role Permissions
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
          max-width: 680px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        }

        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: #0b1329;
        }

        .modal-pill {
          display: inline-block;
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
          padding: 4px 8px;
        }

        .alert-error {
          margin: 16px 24px 0 24px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 8px;
          color: #ef4444;
          font-size: 12px;
          font-weight: 700;
        }

        .roles-list {
          padding: 16px 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 420px;
        }

        .role-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 12px 16px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .role-item:hover {
          border-color: #475569;
          background: #243248;
        }

        .role-item-active {
          border-color: #38bdf8;
          background: rgba(56, 189, 248, 0.08);
        }

        .role-checkbox {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          accent-color: #38bdf8;
          cursor: pointer;
        }

        .role-info {
          flex: 1;
        }

        .role-label-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 2px;
        }

        .role-name {
          font-size: 14px;
          font-weight: 700;
          color: #f1f5f9;
        }

        .role-code {
          font-size: 10px;
          padding: 2px 6px;
          background: #0f172a;
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .role-desc {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.4;
        }

        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: #0b1329;
        }

        .btn-secondary {
          background: #1e293b;
          border: 1px solid #334155;
          color: #94a3b8;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: #334155;
          color: #f8fafc;
        }

        .btn-primary {
          background: #0284c7;
          border: none;
          color: #ffffff;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-primary:hover {
          background: #0369a1;
        }
      `}</style>
    </div>
  );
}
