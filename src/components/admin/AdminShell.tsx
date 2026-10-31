"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AdminSidebar } from "./AdminSidebar";
import type { AdminRole } from "./types";

interface AdminShellProps {
  children: React.ReactNode;
}

interface StoredStaffUser {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  assignedLocation?: string;
  role?: AdminRole;
  roles?: AdminRole[];
  isStaff?: boolean;
}

export function AdminShell({ children }: AdminShellProps) {
  const [activeRole, setActiveRole] = useState<AdminRole>("SUPER_ADMIN");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<"SSR_OR_CHECKING" | "AUTHENTICATED" | "UNAUTHENTICATED">(
    "SSR_OR_CHECKING"
  );
  const [staffUser, setStaffUser] = useState<StoredStaffUser | null>(null);

  useEffect(() => {
    // 1. Check for temporary Google Auth Sync cookie from OAuth redirect
    try {
      const cookieStr = typeof document !== "undefined" ? document.cookie : "";
      const syncCookie = cookieStr
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("nca_auth_sync="));

      if (syncCookie) {
        const rawVal = decodeURIComponent(syncCookie.split("=")[1] || "");
        const parsed = JSON.parse(rawVal) as StoredStaffUser;
        if (parsed && parsed.isStaff) {
          localStorage.setItem("nca_user", JSON.stringify(parsed));
          setStaffUser(parsed);
          if (parsed.role) setActiveRole(parsed.role);
          setAuthStatus("AUTHENTICATED");
          document.cookie = "nca_auth_sync=; Path=/; Max-Age=0";
        }
      }
    } catch {
      // Cookie parse fallback
    }

    // 2. Hydrate from localStorage for instant UI rendering without flicker
    try {
      const rawUser = localStorage.getItem("nca_user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser) as StoredStaffUser;
        if (parsed && parsed.isStaff) {
          setStaffUser(parsed);
          if (parsed.role) {
            setActiveRole(parsed.role);
          }
          setAuthStatus("AUTHENTICATED");
        }
      }
    } catch {
      // Ignore parse errors
    }

    // 3. Always verify authoritative server session against /api/v1/auth/staff/me
    fetch("/api/v1/auth/staff/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("unauthorized");
      })
      .then((data) => {
        if (data?.staff) {
          const userRoles: AdminRole[] = (data.staff.roles || data.roles || []) as AdminRole[];
          const primaryRole: AdminRole = userRoles.includes("SUPER_ADMIN")
            ? "SUPER_ADMIN"
            : (userRoles[0] as AdminRole) || "SUPER_ADMIN";
          const staffName =
            data.staff.full_name ||
            data.staff.fullName ||
            data.staff.name ||
            data.staff.email?.split("@")[0] ||
            "Staff Member";

          const profile: StoredStaffUser = {
            id: data.staff.id,
            name: staffName,
            email: data.staff.email,
            phone: data.staff.phone,
            role: primaryRole,
            roles: userRoles,
            isStaff: true,
          };
          localStorage.setItem("nca_user", JSON.stringify(profile));
          setStaffUser(profile);
          setActiveRole(primaryRole);
          setAuthStatus("AUTHENTICATED");
        } else {
          throw new Error("not staff");
        }
      })
      .catch(() => {
        const rawUser = typeof window !== "undefined" ? localStorage.getItem("nca_user") : null;
        if (!rawUser) {
          setAuthStatus("UNAUTHENTICATED");
          window.location.replace("/auth/login?mode=staff&redirect=/admin");
        }
      });

    // Live-sync sidebar/topbar when the staff member edits their profile in /admin/settings
    const handleProfileUpdated = (event: Event) => {
      const custom = event as CustomEvent<StoredStaffUser>;
      if (custom.detail) {
        setStaffUser((prev) => ({ ...prev, ...custom.detail }));
      }
    };
    window.addEventListener("nca-staff-profile-updated", handleProfileUpdated);
    return () => window.removeEventListener("nca-staff-profile-updated", handleProfileUpdated);
  }, []);

  const handleStaffSignOut = () => {
    localStorage.removeItem("nca_token");
    localStorage.removeItem("nca_user");
    window.location.href = "/auth/login?mode=staff";
  };

  if (authStatus === "UNAUTHENTICATED") {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f4f6fb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
        }}
      >
        <div
          style={{
            maxWidth: "440px",
            width: "100%",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              backgroundColor: "#fef3c7",
              color: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              margin: "0 auto 16px",
            }}
          >
            🔐
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px" }}>
            Staff Authentication Required
          </h1>
          <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: 1.5, margin: "0 0 24px" }}>
            Default admin auto-login is disabled for security. Please sign in with your authorized staff credentials to access the NCAMart Backoffice.
          </p>
          <Link
            href="/auth/login?mode=staff&redirect=/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "12px 20px",
              borderRadius: "12px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontWeight: "700",
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            Go to Staff Login →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell-layout" data-testid="admin-shell">
      {/* Accessible Admin Skip Link */}
      <a href="#admin-main-content" className="admin-skip-link" data-testid="admin-skip-link">
        Skip to admin operations
      </a>

      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Persistent Left RBAC Sidebar */}
      <div className={`admin-sidebar-wrapper ${isMobileSidebarOpen ? "open" : ""}`}>
        <AdminSidebar
          currentRole={activeRole}
          onRoleChange={setActiveRole}
          staffProfile={
            staffUser
              ? {
                  name: staffUser.name,
                  email: staffUser.email,
                  roles: staffUser.roles,
                  assignedLocation: staffUser.assignedLocation || "Nawabpur Central Godown & HQ",
                }
              : null
          }
        />
      </div>

      {/* Main Content Area */}
      <div className="admin-main-wrap">
        {/* Top Navbar */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="admin-mobile-menu-btn"
              onClick={() => setIsMobileSidebarOpen((v) => !v)}
              aria-label="Toggle admin navigation"
            >
              ☰
            </button>
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
              <Link
                href="/admin/settings"
                className="topbar-icon-btn"
                title="Account & 2FA Settings"
                aria-label="Account Settings"
                style={{ textDecoration: "none" }}
              >
                ⚙️
              </Link>
              <button
                type="button"
                className="topbar-icon-btn"
                title="System Notifications"
                aria-label="Notifications"
              >
                🔔
                <span className="bell-badge">3</span>
              </button>
              <button
                type="button"
                onClick={handleStaffSignOut}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(239, 68, 68, 0.14)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#fca5a5",
                  fontSize: "11.5px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* View Content */}
        <main id="admin-main-content" className="admin-content-area" tabIndex={-1}>
          {children}
        </main>
      </div>

      <style jsx>{`
        .admin-skip-link {
          position: absolute;
          top: -100px;
          left: 16px;
          background: #38bdf8;
          color: #032135;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 800;
          font-size: 12px;
          z-index: 99999;
          text-decoration: none;
          transition: top 0.15s ease-in-out;
        }

        .admin-skip-link:focus,
        .admin-skip-link:focus-visible {
          top: 16px;
          outline: 3px solid #f8fafc;
          outline-offset: 2px;
        }

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

        .admin-mobile-menu-btn {
          display: none;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #f8fafc;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
        }

        .admin-sidebar-backdrop {
          display: none;
        }

        @media (max-width: 900px) {
          .admin-mobile-menu-btn {
            display: inline-flex;
          }

          .admin-sidebar-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 200;
            transform: translateX(-100%);
            transition: transform 0.22s ease;
          }

          .admin-sidebar-wrapper.open {
            transform: translateX(0);
          }

          .admin-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, 0.65);
            backdrop-filter: blur(4px);
            z-index: 190;
          }

          .admin-topbar {
            padding: 0 12px;
          }

          .sep,
          .breadcrumb-current {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
