import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { AdminSidebar } from "../AdminSidebar";
import { ExecutiveOverviewView } from "../ExecutiveOverviewView";
import { AdminShell } from "../AdminShell";
import { ToastProvider } from "@/components/ui/toast";

describe("F31: Admin Backoffice Shell, RBAC Navigation & Metrics", () => {
  it("renders AdminSidebar with branding, staff profile, and SUPER_ADMIN full access navigation", () => {
    const html = renderToString(
      <ToastProvider>
        <AdminSidebar currentRole="SUPER_ADMIN" />
      </ToastProvider>
    );

    // Branding
    expect(html).toContain("NCAMart");
    expect(html).toContain("Operations Backoffice");

    // Profile & Role Selector
    expect(html).toContain("Engr. Mahmudul Hasan");
    expect(html).toContain("Nawabpur Central Godown &amp; HQ");
    expect(html).toContain("Active Staff Role (RBAC)");
    expect(html).toContain("SUPER_ADMIN (Full Access)");

    // SUPER_ADMIN navigation items across sections
    expect(html).toContain("Executive Dashboard");
    expect(html).toContain("Products &amp; SKUs");
    expect(html).toContain("Fulfillment Pipeline");
    expect(html).toContain("QC Station &amp; Seals");
    expect(html).toContain("Runner Sourcing Desk");
    expect(html).toContain("General Ledger &amp; VAT");
    expect(html).toContain("Support &amp; RMA Desk");
    expect(html).toContain("Counter POS Console");
    expect(html).toContain("Staff Roles &amp; Audit");
  });

  it("applies granular RBAC filtering: FIELD_RUNNER sees only runner sourcing and POS/finance are hidden", () => {
    const runnerHtml = renderToString(
      <ToastProvider>
        <AdminSidebar currentRole="FIELD_RUNNER" />
      </ToastProvider>
    );

    // Runner should see runner mobile PWA
    expect(runnerHtml).toContain("Runner Mobile PWA");

    // Runner should NOT see General Ledger, Staff Roles, or Executive Dashboard
    expect(runnerHtml).not.toContain("General Ledger &amp; VAT");
    expect(runnerHtml).not.toContain("Staff Roles &amp; Audit");
    expect(runnerHtml).not.toContain("Executive Dashboard");
  });

  it("applies granular RBAC filtering: FINANCE_OFFICER sees financial ledger and executive dashboard, but not QC Station or Runner PWA", () => {
    const financeHtml = renderToString(
      <ToastProvider>
        <AdminSidebar currentRole="FINANCE_OFFICER" />
      </ToastProvider>
    );

    // Finance sees ledger and executive dashboard
    expect(financeHtml).toContain("General Ledger &amp; VAT");
    expect(financeHtml).toContain("Executive Dashboard");

    // Finance does NOT see QC Station or Runner PWA
    expect(financeHtml).not.toContain("QC Station &amp; Seals");
    expect(financeHtml).not.toContain("Runner Mobile PWA");
  });

  it("renders ExecutiveOverviewView with 5 KPI cards in integer paisa BDT, SVG area chart, and live activity feed", () => {
    const html = renderToString(
      <ToastProvider>
        <ExecutiveOverviewView currentRole="SUPER_ADMIN" />
      </ToastProvider>
    );

    // Header & Quick Actions
    expect(html).toContain("Executive Operations Hub");
    expect(html).toContain("Nawabpur Operations Live Feed");
    expect(html).toContain("+ New SKU");
    expect(html).toContain("Print Seals");
    expect(html).toContain("Dispatch Queue");

    // 5 KPI Cards
    expect(html).toContain("Gross Revenue (MTD)");
    expect(html).toContain("৳4,892,450.00");
    expect(html).toContain("Daily Drop-and-Pack");
    expect(html).toContain("142");
    expect(html).toContain("Active Pre-Orders");
    expect(html).toContain("38");
    expect(html).toContain("Courier RTO Rate");
    expect(html).toContain("2.40");
    expect(html).toContain("Open RMA Claims");
    expect(html).toContain("3");

    // SVG Area Chart
    expect(html).toContain("revenue-area-chart");
    expect(html).toContain("Last 7 Days");
    expect(html).toContain("Last 30 Days");

    // Live Activity Ticker
    expect(html).toContain("live-activity-feed");
    expect(html).toContain("New Drop-and-Pack Order");
    expect(html).toContain("Runner Shakil Mollah purchased");
    expect(html).toContain("QC Station approved Batch");
    expect(html).toContain("Public Holographic Seal verified");
  });

  it("renders AdminShell with persistent sidebar, topbar location breadcrumbs, and role indicator badge", () => {
    const html = renderToString(
      <ToastProvider>
        <AdminShell>
          <div data-testid="test-child-content">Admin Content View</div>
        </AdminShell>
      </ToastProvider>
    );

    expect(html).toContain("admin-shell");
    expect(html).toContain("Nawabpur Central Godown Hub");
    expect(html).toContain("Control Center");
    expect(html).toContain("Viewing as:");
    expect(html).toContain("SUPER_ADMIN");
    expect(html).toContain("test-child-content");
  });
});
