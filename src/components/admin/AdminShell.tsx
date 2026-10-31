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
    // Cross-tab synchronization logout handler
    const syncLogout = () => {
      setStaffUser(null);
      setAuthStatus("UNAUTHENTICATED");
      if (typeof window !== "undefined") {
        localStorage.removeItem("nca_token");
        localStorage.removeItem("nca_user");
        window.location.replace("/auth/login?mode=staff&logged_out=1");
      }
    };

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
      const rawUser = typeof window !== "undefined" ? localStorage.getItem("nca_user") : null;
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
    const verifyServerSession = () => {
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
          syncLogout();
        });
    };

    verifyServerSession();

    // 4. Cross-tab synchronization via BroadcastChannel
    let authChannel: BroadcastChannel | null = null;
    try {
      authChannel = new BroadcastChannel("nca_auth_channel");
      authChannel.onmessage = (event) => {
        if (event.data?.type === "LOGOUT" || event.data?.type === "UNAUTHORIZED") {
          syncLogout();
        }
      };
    } catch {
      // BroadcastChannel unsupported fallback
    }

    // 5. Cross-tab synchronization via localStorage StorageEvent
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "nca_logout_event" || (e.key === "nca_user" && !e.newValue)) {
        syncLogout();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // 6. Tab visibility / Focus listener to immediately re-check session when tab is brought to foreground
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        const storedUser = localStorage.getItem("nca_user");
        if (!storedUser) {
          syncLogout();
        } else {
          verifyServerSession();
        }
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    // Live-sync sidebar/topbar when the staff member edits their profile in /admin/settings
    const handleProfileUpdated = (event: Event) => {
      const custom = event as CustomEvent<StoredStaffUser>;
      if (custom.detail) {
        setStaffUser((prev) => ({ ...prev, ...custom.detail }));
      }
    };
    window.addEventListener("nca-staff-profile-updated", handleProfileUpdated);

    return () => {
      if (authChannel) {
        try {
          authChannel.close();
        } catch {
          // ignore
        }
      }
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("nca-staff-profile-updated", handleProfileUpdated);
    };
  }, []);

  const handleStaffSignOut = async () => {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    } catch {
      // ignore
    }

    try {
      const channel = new BroadcastChannel("nca_auth_channel");
      channel.postMessage({ type: "LOGOUT", timestamp: Date.now() });
      channel.close();
    } catch {
      // BroadcastChannel unsupported
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("nca_logout_event", Date.now().toString());
      localStorage.removeItem("nca_token");
      localStorage.removeItem("nca_user");
      window.location.replace("/auth/login?mode=staff");
    }
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
            <div className="breadcrumbs-wrap">
              <span className="location-pill">📍 Nawabpur Central Godown Hub</span>
              <span className="sep">/</span>
              <span className="breadcrumb-current">Control Center</span>
            </div>
          </div>

          <div className="topbar-center">
            <div className="topbar-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search or type a command..."
                className="topbar-search-input"
              />
            </div>
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
                className="topbar-signout-btn"
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
          background: #f4f6f8;
          color: #151515;
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
          height: 62px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .breadcrumbs-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .location-pill {
          color: #151515;
          font-weight: 700;
        }

        .sep {
          color: #9ca3af;
        }

        .breadcrumb-current {
          color: #6b7280;
          font-weight: 600;
        }

        .topbar-center {
          flex: 1;
          max-width: 420px;
          margin: 0 24px;
        }

        @media (max-width: 768px) {
          .topbar-center {
            display: none;
          }
        }

        .topbar-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          padding: 8px 14px;
          border-radius: 9999px;
          transition: all 0.15s ease;
        }

        .topbar-search-box:focus-within {
          background: #ffffff;
          border-color: #bfe77d;
          box-shadow: 0 0 0 3px rgba(191, 231, 125, 0.25);
        }

        .search-icon {
          font-size: 13px;
          opacity: 0.6;
        }

        .topbar-search-input {
          border: none;
          background: transparent;
          outline: none;
          font-size: 13px;
          width: 100%;
          color: #151515;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .role-indicator-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          font-weight: 800;
          color: #151515;
          background: #bfe77d;
          border: 1px solid rgba(0, 0, 0, 0.08);
          padding: 5px 12px;
          border-radius: 9999px;
        }

        .role-indicator-badge .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #151515;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .topbar-icon-btn {
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          color: #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.15s ease;
        }

        .topbar-icon-btn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .topbar-signout-btn {
          padding: 6px 14px;
          border-radius: 9999px;
          background-color: #fee2e2;
          border: 1px solid #fca5a5;
          color: #b91c1c;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .topbar-signout-btn:hover {
          background-color: #fecaca;
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
