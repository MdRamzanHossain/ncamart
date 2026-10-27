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
  onSave: (staffId: string, updatedRoles: AdminRole[]) => void;
}

export function StaffRoleModal({
  staff,
  allStaff,
  isOpen,
  onClose,
  onSave,
}: StaffRoleModalProps) {
  const [selectedRoles, setSelectedRoles] = useState<AdminRole[]>(staff.roles);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Last Super Admin Guard (DECISIONS.md #62 / PRD §3.9)
  const isTargetSuperAdmin = staff.roles.includes("SUPER_ADMIN");
  const totalSuperAdmins = allStaff.filter(
    (s) => s.status === "ACTIVE" && s.roles.includes("SUPER_ADMIN")
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
    if (selectedRoles.length === 0) {
      setErrorMsg("A staff member must have at least one assigned role.");
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
    onSave(staff.id, selectedRoles);
    onClose();
  };

  return (
    <div className="modal-backdrop" data-testid="staff-role-modal">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-pill">RBAC Governance · PRD §3.9</div>
            <h2 className="modal-title">Edit Staff Roles &amp; Permissions</h2>
            <p className="modal-sub">
              Configuring roles for <strong>{staff.name}</strong> ({staff.email})
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

        <div className="roles-list">
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
          max-height: 480px;
        }

        .role-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 12px 14px;
          background: #0b1329;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .role-item:hover {
          border-color: rgba(255, 255, 255, 0.2);
          background: #111e38;
        }

        .role-item-active {
          border-color: rgba(56, 189, 248, 0.4);
          background: rgba(56, 189, 248, 0.05);
        }

        .role-checkbox {
          margin-top: 3px;
          cursor: pointer;
          width: 16px;
          height: 16px;
          accent-color: #38bdf8;
        }

        .role-info {
          flex: 1;
        }

        .role-label-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 2px;
        }

        .role-name {
          font-size: 13px;
          font-weight: 700;
          color: #f8fafc;
        }

        .role-code {
          font-size: 10px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .role-desc {
          font-size: 11px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.4;
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

        .btn-primary {
          padding: 10px 20px;
          background: #38bdf8;
          border: none;
          border-radius: 8px;
          color: #032135;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.1s ease;
        }

        .btn-primary:active {
          transform: scale(0.98);
        }

        .font-mono {
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}
