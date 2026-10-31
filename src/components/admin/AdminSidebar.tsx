"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole, AdminNavSection, StaffAdminProfile } from "./types";

export const DEFAULT_ADMIN_STAFF: StaffAdminProfile = {
  id: "STAFF-001",
  name: "Engr. Mahmudul Hasan",
  email: "mahmudul@ncamart.com",
  roles: [
    "SUPER_ADMIN",
  ],
  activeRole: "SUPER_ADMIN",
  assignedLocation: "Nawabpur Central Godown & HQ",
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: "Overview",
    items: [
      {
        id: "overview",
        label: "Executive Dashboard",
        href: "/admin",
        icon: "📊",
        allowedRoles: [
          "SUPER_ADMIN",
          "OPS_MANAGER",
          "FINANCE_OFFICER",
          "CATALOG_MANAGER",
          "CUSTOMER_SUPPORT",
        ],
      },
    ],
  },
  {
    title: "Catalog & SKUs",
    items: [
      {
        id: "catalog-products",
        label: "Products & SKUs",
        href: "/admin/catalog",
        icon: "🏷️",
        badge: "1,248",
        allowedRoles: ["SUPER_ADMIN", "OPS_MANAGER", "CATALOG_MANAGER"],
      },
    ],
  },
  {
    title: "Orders & Fulfillment",
    items: [
      {
        id: "orders-kanban",
        label: "Fulfillment Pipeline",
        href: "/admin/orders",
        icon: "📦",
        badge: "18",
        badgeVariant: "warning",
        allowedRoles: [
          "SUPER_ADMIN",
          "OPS_MANAGER",
          "DISPATCH_STAFF",
          "CUSTOMER_SUPPORT",
        ],
      },
    ],
  },
  {
    title: "Godown & QC",
    items: [
      {
        id: "godown-qc",
        label: "QC Station & Seals",
        href: "/admin/qc",
        icon: "🔬",
        badge: "5",
        badgeVariant: "primary",
        allowedRoles: ["SUPER_ADMIN", "OPS_MANAGER", "GODOWN_MANAGER", "QC_TECHNICIAN"],
      },
    ],
  },
  {
    title: "Runner Sourcing",
    items: [
      {
        id: "runner-sourcing",
        label: "Runner Sourcing Desk",
        href: "/admin/sourcing",
        icon: "🏃",
        badge: "3",
        badgeVariant: "warning",
        allowedRoles: ["SUPER_ADMIN", "OPS_MANAGER", "SOURCING_MANAGER"],
      },
      {
        id: "runner-pwa",
        label: "Runner Mobile PWA",
        href: "/runner",
        icon: "📱",
        allowedRoles: ["SUPER_ADMIN", "FIELD_RUNNER"],
      },
    ],
  },
  {
    title: "Financial Ledger",
    items: [
      {
        id: "finance-ledger",
        label: "General Ledger & VAT",
        href: "/admin/finance",
        icon: "📑",
        allowedRoles: ["SUPER_ADMIN", "FINANCE_OFFICER"],
      },
    ],
  },
  {
    title: "Customer Support & RMA",
    items: [
      {
        id: "support-rma",
        label: "Support & RMA Desk",
        href: "/admin/support",
        icon: "🎧",
        badge: "2",
        badgeVariant: "destructive",
        allowedRoles: ["SUPER_ADMIN", "OPS_MANAGER", "CUSTOMER_SUPPORT"],
      },
    ],
  },
  {
    title: "Showroom Counter POS",
    items: [
      {
        id: "showroom-pos",
        label: "Counter POS Console",
        href: "/pos",
        icon: "🖥️",
        allowedRoles: ["SUPER_ADMIN", "SHOWROOM_POS_STAFF"],
      },
    ],
  },
  {
    title: "Staff & Governance",
    items: [
      {
        id: "users-management",
        label: "Registered Users & Access",
        href: "/admin/users",
        icon: "👥",
        allowedRoles: ["SUPER_ADMIN", "OPS_MANAGER"],
      },
      {
        id: "account-settings",
        label: "Account & 2FA Settings",
        href: "/admin/settings",
        icon: "⚙️",
        allowedRoles: [
          "SUPER_ADMIN",
          "OPS_MANAGER",
          "SOURCING_MANAGER",
          "GODOWN_MANAGER",
          "QC_TECHNICIAN",
          "FIELD_RUNNER",
          "SHOWROOM_POS_STAFF",
          "CATALOG_MANAGER",
          "CUSTOMER_SUPPORT",
          "FINANCE_OFFICER",
          "DISPATCH_STAFF",
        ],
      },
      {
        id: "security-roles",
        label: "Staff Roles & Audit",
        href: "/admin/security",
        icon: "🛡️",
        allowedRoles: ["SUPER_ADMIN"],
      },
      {
        id: "system-health",
        label: "System Health & Queues",
        href: "/admin/queues",
        icon: "⚡",
        allowedRoles: ["SUPER_ADMIN", "OPS_MANAGER"],
      },
    ],
  },
];

interface AdminSidebarProps {
  currentRole?: AdminRole;
  onRoleChange?: (newRole: AdminRole) => void;
  staffProfile?: {
    name?: string;
    email?: string;
    assignedLocation?: string;
  } | null;
}

export function AdminSidebar({ currentRole = "SUPER_ADMIN", onRoleChange, staffProfile }: AdminSidebarProps) {
  const pathname = usePathname();
  const [activeRole, setActiveRole] = useState<AdminRole>(currentRole);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setActiveRole(currentRole);
  }, [currentRole]);

  const displayName = staffProfile?.name || DEFAULT_ADMIN_STAFF.name;
  const displayLocation = staffProfile?.assignedLocation || staffProfile?.email || DEFAULT_ADMIN_STAFF.assignedLocation;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "AD";

  const userRoles = staffProfile?.roles && staffProfile.roles.length > 0
    ? staffProfile.roles
    : (staffProfile ? [activeRole] : [
        "SUPER_ADMIN",
        "OPS_MANAGER",
        "SOURCING_MANAGER",
        "GODOWN_MANAGER",
        "QC_TECHNICIAN",
        "FIELD_RUNNER",
        "SHOWROOM_POS_STAFF",
        "CATALOG_MANAGER",
        "CUSTOMER_SUPPORT",
        "FINANCE_OFFICER",
        "DISPATCH_STAFF",
      ] as AdminRole[]);

  const isSuperAdmin = userRoles.includes("SUPER_ADMIN");
  const selectableRoles: AdminRole[] = isSuperAdmin
    ? [
        "SUPER_ADMIN",
        "OPS_MANAGER",
        "SOURCING_MANAGER",
        "GODOWN_MANAGER",
        "QC_TECHNICIAN",
        "FIELD_RUNNER",
        "SHOWROOM_POS_STAFF",
        "CATALOG_MANAGER",
        "CUSTOMER_SUPPORT",
        "FINANCE_OFFICER",
        "DISPATCH_STAFF",
      ]
    : userRoles;

  const handleRoleSelect = (role: AdminRole) => {
    setActiveRole(role);
    if (onRoleChange) onRoleChange(role);
  };

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Filter navigation items by RBAC allowed roles
  const filteredSections = ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.allowedRoles.includes(activeRole)),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="admin-sidebar" data-testid="admin-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <Link href="/admin" className="brand-link">
          <span className="brand-logo">⚡</span>
          <div>
            <div className="brand-name">NCAMart</div>
            <div className="brand-sub">Operations Backoffice</div>
          </div>
        </Link>
      </div>

      {/* Staff Profile & Interactive RBAC Role Switcher */}
      <div className="staff-profile-card">
        <div className="staff-avatar-row" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div className="staff-avatar">{initials}</div>
            <div className="staff-info">
              <span className="staff-name">{displayName}</span>
              <span className="staff-loc">{displayLocation}</span>
            </div>
          </div>
          <Link
            href="/admin/settings"
            title="Account & 2FA Settings"
            aria-label="Account & 2FA Settings"
            style={{
              fontSize: "14px",
              textDecoration: "none",
              padding: "4px 6px",
              borderRadius: "6px",
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              flexShrink: 0,
            }}
          >
            ⚙️
          </Link>
        </div>

        <div className="role-selector-wrap">
          <label htmlFor="staff-role-select" className="role-label">
            Active Staff Role (RBAC)
          </label>
          <select
            id="staff-role-select"
            className="role-select"
            value={activeRole}
            onChange={(e) => handleRoleSelect(e.target.value as AdminRole)}
            data-testid="admin-role-selector"
          >
            {selectableRoles.includes("SUPER_ADMIN") && (
              <option value="SUPER_ADMIN">👑 SUPER_ADMIN (Full Access)</option>
            )}
            {selectableRoles.includes("OPS_MANAGER") && (
              <option value="OPS_MANAGER">💼 OPS_MANAGER (Operations)</option>
            )}
            {selectableRoles.includes("SOURCING_MANAGER") && (
              <option value="SOURCING_MANAGER">🤝 SOURCING_MANAGER</option>
            )}
            {selectableRoles.includes("GODOWN_MANAGER") && (
              <option value="GODOWN_MANAGER">🏭 GODOWN_MANAGER</option>
            )}
            {selectableRoles.includes("QC_TECHNICIAN") && (
              <option value="QC_TECHNICIAN">🔬 QC_TECHNICIAN</option>
            )}
            {selectableRoles.includes("FIELD_RUNNER") && (
              <option value="FIELD_RUNNER">🏃 FIELD_RUNNER</option>
            )}
            {selectableRoles.includes("SHOWROOM_POS_STAFF") && (
              <option value="SHOWROOM_POS_STAFF">🖥️ SHOWROOM_POS_STAFF</option>
            )}
            {selectableRoles.includes("CATALOG_MANAGER") && (
              <option value="CATALOG_MANAGER">🏷️ CATALOG_MANAGER</option>
            )}
            {selectableRoles.includes("CUSTOMER_SUPPORT") && (
              <option value="CUSTOMER_SUPPORT">🎧 CUSTOMER_SUPPORT</option>
            )}
            {selectableRoles.includes("FINANCE_OFFICER") && (
              <option value="FINANCE_OFFICER">📑 FINANCE_OFFICER</option>
            )}
            {selectableRoles.includes("DISPATCH_STAFF") && (
              <option value="DISPATCH_STAFF">📦 DISPATCH_STAFF</option>
            )}
          </select>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-nav" aria-label="Admin Navigation">
        {filteredSections.map((section) => {
          const isCollapsed = collapsedSections[section.title];
          return (
            <div key={section.title} className="nav-section">
              <button
                type="button"
                className="section-title-btn"
                onClick={() => toggleSection(section.title)}
                aria-expanded={!isCollapsed}
              >
                <span>{section.title}</span>
                <span className="collapse-chevron">{isCollapsed ? "▸" : "▾"}</span>
              </button>

              {!isCollapsed && (
                <ul className="nav-item-list">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.id} className="nav-item">
                        <Link
                          href={item.href}
                          className={`nav-link ${isActive ? "active" : ""}`}
                          data-testid={`nav-link-${item.id}`}
                        >
                          <span className="nav-icon">{item.icon}</span>
                          <span className="nav-label">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`nav-badge badge-${item.badgeVariant || "default"}`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="sidebar-footer">
        <div className="status-indicator">
          <span className="pulse-dot" />
          <span className="status-text">Postgres 16 · Redis Active</span>
        </div>
        <span className="build-ver">NCAMart v1.4-PROD</span>
      </div>

      <style jsx>{`
        .admin-sidebar {
          width: 260px;
          min-width: 260px;
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          height: 100vh;
          position: sticky;
          top: 0;
          display: flex;
          flex-direction: column;
          color: #151515;
          overflow-y: auto;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        .sidebar-brand {
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .brand-link {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }

        .brand-logo {
          font-size: 20px;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #bfe77d;
          color: #151515;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(191, 231, 125, 0.4);
        }

        .brand-name {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.3px;
          color: #151515;
        }

        .brand-sub {
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
        }

        /* Profile & Role Switcher */
        .staff-profile-card {
          padding: 14px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .staff-avatar-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .staff-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #bfe77d;
          color: #151515;
          font-size: 12px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .staff-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .staff-name {
          font-size: 12px;
          font-weight: 800;
          color: #151515;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .staff-loc {
          font-size: 10px;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .role-selector-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .role-label {
          font-size: 10px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .role-select {
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #151515;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 8px;
          border-radius: 8px;
          outline: none;
          cursor: pointer;
        }

        .role-select:focus {
          border-color: #bfe77d;
          box-shadow: 0 0 0 2px rgba(191, 231, 125, 0.25);
        }

        /* Nav List */
        .sidebar-nav {
          flex: 1;
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .nav-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .section-title-btn {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 8px;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }

        .section-title-btn:hover {
          color: #4b5563;
        }

        .collapse-chevron {
          font-size: 11px;
        }

        .nav-item-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 9999px;
          color: #4b5563;
          text-decoration: none;
          font-size: 12.5px;
          font-weight: 600;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .nav-link:hover {
          background: #f3f4f6;
          color: #151515;
        }

        .nav-link.active {
          background: #bfe77d;
          color: #151515;
          font-weight: 800;
          border-left: none;
          box-shadow: 0 2px 6px rgba(191, 231, 125, 0.35);
        }

        .nav-icon {
          font-size: 15px;
        }

        .nav-label {
          flex: 1;
        }

        .nav-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .badge-default {
          background: #e5e7eb;
          color: #374151;
        }

        .badge-primary {
          background: #dbeafe;
          color: #1e40af;
        }

        .badge-warning {
          background: #fef3c7;
          color: #b45309;
        }

        .badge-destructive {
          background: #fee2e2;
          color: #b91c1c;
        }

        /* Footer */
        .sidebar-footer {
          padding: 12px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: #0b1329;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #64748b;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .build-ver {
          font-family: monospace;
          color: #475569;
        }
      `}</style>
    </aside>
  );
}
