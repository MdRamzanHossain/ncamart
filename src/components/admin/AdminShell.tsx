"use client";

import React, { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import type { AdminRole } from "./types";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [activeRole, setActiveRole] = useState<AdminRole>("SUPER_ADMIN");

  return (
    <div className="admin-shell-layout" data-testid="admin-shell">
      {/* Persistent Left RBAC Sidebar */}
      <AdminSidebar currentRole={activeRole} onRoleChange={setActiveRole} />

      {/* Main Content Area */}
      <div className="admin-main-wrap">
        {/* Top Navbar */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <span className="location-pill">📍 Nawabpur Central Godown Hub</span>
            <span className="sep">/</span>
            <span className="breadcrumb-current">Control Center</span>
          </div>

          <div className="topbar-right">
            <div className="role-indicator-badge">
              <span className="dot" />
              <span>Viewing as: {activeRole}</span>
            </div>

            <div className="topbar-actions">
              <button
                type="button"
                className="topbar-icon-btn"
                title="System Notifications"
                aria-label="Notifications"
              >
                🔔
                <span className="bell-badge">3</span>
              </button>
            </div>
          </div>
        </header>

        {/* View Content */}
        <main className="admin-content-area">{children}</main>
      </div>

      <style jsx>{`
        .admin-shell-layout {
          display: flex;
          min-height: 100vh;
          background: #020617;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        .admin-main-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow-x: hidden;
        }

        .admin-topbar {
          height: 56px;
          background: #0b1329;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }

        .location-pill {
          color: #38bdf8;
          font-weight: 700;
        }

        .sep {
          color: #475569;
        }

        .breadcrumb-current {
          color: #94a3b8;
          font-weight: 600;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .role-indicator-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          padding: 4px 10px;
          border-radius: 9999px;
          font-family: monospace;
        }

        .role-indicator-badge .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f59e0b;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .topbar-icon-btn {
          position: relative;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
        }

        .bell-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #ef4444;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .admin-content-area {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}
