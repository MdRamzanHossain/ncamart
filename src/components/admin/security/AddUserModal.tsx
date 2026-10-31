"use client";

import React, { useState } from "react";
import { ALL_ADMIN_ROLES } from "./mockData";
import type { AdminRole } from "../types";

export interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newUser: any) => void;
}

export function AddUserModal({ isOpen, onClose, onCreated }: AddUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accountType, setAccountType] = useState<"STAFF" | "CUSTOMER">("STAFF");
  const [selectedRoles, setSelectedRoles] = useState<AdminRole[]>(["OPS_MANAGER"]);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleRole = (role: AdminRole) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter((r) => r !== role));
      }
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setErrorMsg("Please fill in Name, Email, and Phone.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        roles: accountType === "STAFF" ? selectedRoles : ["CUSTOMER"],
        status: "ACTIVE",
        password: password.trim() ? password.trim() : undefined,
      };

      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create user account.");
      }

      onCreated(data.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-pill">Identity &amp; Governance</div>
            <h2 className="modal-title">Create Staff / User Account</h2>
          </div>
          <button type="button" className="btn-close" onClick={onClose} disabled={isSubmitting}>
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="alert-error" style={{ margin: "14px 0", padding: "10px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", borderRadius: "8px", fontSize: "13px" }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Tanvir Hasan"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "#1e293b", border: "1px solid #334155", color: "#f8fafc", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@ncamart.com"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "#1e293b", border: "1px solid #334155", color: "#f8fafc", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Mobile Phone</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 17XXXXXXXX"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "#1e293b", border: "1px solid #334155", color: "#f8fafc", fontSize: "13px" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Account Type</label>
            <div style={{ display: "flex", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#cbd5e1", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="accType"
                  checked={accountType === "STAFF"}
                  onChange={() => setAccountType("STAFF")}
                />
                Staff Member (Backoffice / Operations)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#cbd5e1", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="accType"
                  checked={accountType === "CUSTOMER"}
                  onChange={() => setAccountType("CUSTOMER")}
                />
                Customer (Storefront)
              </label>
            </div>
          </div>

          {accountType === "STAFF" && (
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                Assign Roles (RBAC)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", maxHeight: "180px", overflowY: "auto", padding: "8px", background: "#0b101b", borderRadius: "8px", border: "1px solid #1e293b" }}>
                {ALL_ADMIN_ROLES.map(({ role, label }) => {
                  const isChecked = selectedRoles.includes(role);
                  return (
                    <label
                      key={role}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: isChecked ? "#60a5fa" : "#94a3b8",
                        cursor: "pointer",
                        padding: "4px 6px",
                        borderRadius: "4px",
                        background: isChecked ? "rgba(59, 130, 246, 0.1)" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRole(role)}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
              Initial Password (Optional — auto-generated if left blank)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for secure auto-gen"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "#1e293b", border: "1px solid #334155", color: "#f8fafc", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #334155", background: "transparent", color: "#94a3b8", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "#ffffff", fontWeight: 700, cursor: isSubmitting ? "not-allowed" : "pointer" }}
            >
              {isSubmitting ? "Creating..." : "Create Account →"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .modal-dialog {
          max-width: 560px;
          width: 100%;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        }
        .modal-pill {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 9999px;
          display: inline-block;
          margin-bottom: 6px;
          font-weight: 700;
        }
        .modal-title {
          font-size: 18px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0;
        }
        .btn-close {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 18px;
          cursor: pointer;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
      `}</style>
    </div>
  );
}

