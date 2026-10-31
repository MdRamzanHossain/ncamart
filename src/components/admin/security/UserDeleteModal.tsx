"use client";

import React, { useState } from "react";
import type { StaffUser } from "./types";

export interface UserDeleteModalProps {
  user: StaffUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string) => Promise<void>;
}

export function UserDeleteModal({
  user,
  isOpen,
  onClose,
  onConfirm,
}: UserDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await onConfirm(user.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete user account.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" data-testid="user-delete-modal">
      <div className="modal-dialog modal-dialog-delete">
        <div className="modal-header">
          <div>
            <div className="modal-pill pill-danger">Permanent Deletion</div>
            <h2 className="modal-title">Delete User Account</h2>
          </div>
          <button type="button" className="btn-close" onClick={onClose} disabled={isDeleting}>
            ✕
          </button>
        </div>

        <div className="modal-body-delete">
          <p className="warning-text">
            Are you sure you want to permanently delete this user account? This action cannot be undone.
          </p>

          <div className="user-info-box">
            <div className="user-name font-bold">{user.name}</div>
            <div className="user-email font-mono">{user.email}</div>
            {user.phone && <div className="user-phone font-mono">{user.phone}</div>}
            <div className="user-roles">
              {user.roles.map((r) => (
                <span key={r} className="role-tag font-mono">
                  {r}
                </span>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="alert-error" style={{ marginTop: "16px" }}>
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
            disabled={isDeleting}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "transparent",
              color: "#cbd5e1",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger-confirm"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#ef4444",
              color: "#ffffff",
              fontWeight: 700,
              cursor: isDeleting ? "not-allowed" : "pointer",
            }}
          >
            {isDeleting ? "Deleting..." : "🗑️ Yes, Permanently Delete"}
          </button>
        </div>
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
        .modal-dialog-delete {
          max-width: 480px;
          width: 100%;
          background: #0f172a;
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        }
        .pill-danger {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
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
        .warning-text {
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.5;
          margin: 16px 0;
        }
        .user-info-box {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 10px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .user-name {
          color: #f8fafc;
          font-size: 14px;
        }
        .user-email,
        .user-phone {
          color: #94a3b8;
          font-size: 12px;
        }
        .user-roles {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .role-tag {
          font-size: 10px;
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

