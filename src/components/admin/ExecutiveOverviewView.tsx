"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { AdminKpiStats, RevenueChartPoint, LiveActivityEvent, AdminRole } from "./types";
import { formatPaisa } from "@/lib/money";

export interface ThemePalette {
  id: string;
  name: string;
  primary: string; // #BFE77D
  accentBlue: string; // #A6C7FF
  accentPeach: string; // #FED591
  accentLavender: string; // #C6BBF9
  canvasBg: string; // #F4F6F8
  cardBg: string; // #FFFFFF
  textColor: string; // #151515
  textMuted: string; // #6B7280
  cardBorder: string; // rgba(0,0,0,0.06)
}

export const THEME_PRESETS: ThemePalette[] = [
  {
    id: "pistachio",
    name: "CoreDesk Pistachio (Default)",
    primary: "#BFE77D",
    accentBlue: "#A6C7FF",
    accentPeach: "#FED591",
    accentLavender: "#C6BBF9",
    canvasBg: "#F4F6F8",
    cardBg: "#FFFFFF",
    textColor: "#151515",
    textMuted: "#6B7280",
    cardBorder: "#E5E7EB",
  },
  {
    id: "ocean",
    name: "Skyline Ocean Blue",
    primary: "#85B6FF",
    accentBlue: "#A6C7FF",
    accentPeach: "#FED591",
    accentLavender: "#C6BBF9",
    canvasBg: "#F0F4F9",
    cardBg: "#FFFFFF",
    textColor: "#0F172A",
    textMuted: "#64748B",
    cardBorder: "#E2E8F0",
  },
  {
    id: "peach",
    name: "Sunset Warm Peach",
    primary: "#FED591",
    accentBlue: "#A6C7FF",
    accentPeach: "#FFBA7A",
    accentLavender: "#C6BBF9",
    canvasBg: "#FAF6F2",
    cardBg: "#FFFFFF",
    textColor: "#1C1917",
    textMuted: "#78716C",
    cardBorder: "#E7E5E4",
  },
  {
    id: "lavender",
    name: "Soft Lavender Amethyst",
    primary: "#C6BBF9",
    accentBlue: "#A6C7FF",
    accentPeach: "#FED591",
    accentLavender: "#E0D7FE",
    canvasBg: "#F7F5FC",
    cardBg: "#FFFFFF",
    textColor: "#1E1B4B",
    textMuted: "#6B7280",
    cardBorder: "#E9D5FF",
  },
  {
    id: "midnight",
    name: "Cyber Midnight (Dark)",
    primary: "#BFE77D",
    accentBlue: "#38BDF8",
    accentPeach: "#F59E0B",
    accentLavender: "#A855F7",
    canvasBg: "#0F172A",
    cardBg: "#1E293B",
    textColor: "#F8FAFC",
    textMuted: "#94A3B8",
    cardBorder: "rgba(255,255,255,0.08)",
  },
];

const MOCK_KPI: AdminKpiStats = {
  grossMerchandisePaisa: 489245000, // ৳4,892,450.00
  grossRevenueGrowthPercent: 14.2,
  dailyDropAndPackOrders: 142,
  dailyOrdersGrowthPercent: 8.5,
  activePreOrdersCount: 38,
  activePreOrderQuotaPaisa: 89000000, // ৳890,000.00
  rtoRateBasisPoints: 240, // 2.40%
  openRmaClaimsCount: 3,
  unresolvedRmaAlerts: 1,
};

const MOCK_CHART_7D: RevenueChartPoint[] = [
  { date: "Saturday", revenuePaisa: 54000000, orderVolume: 82, label: "৳540k (82 orders)" },
  { date: "Sunday", revenuePaisa: 62000000, orderVolume: 96, label: "৳620k (96 orders)" },
  { date: "Monday", revenuePaisa: 58000000, orderVolume: 89, label: "৳580k (89 orders)" },
  { date: "Tuesday", revenuePaisa: 71000000, orderVolume: 114, label: "৳710k (114 orders)" },
  { date: "Wednesday", revenuePaisa: 84000000, orderVolume: 130, label: "৳840k (130 orders)" },
  { date: "Thursday", revenuePaisa: 79000000, orderVolume: 122, label: "৳790k (122 orders)" },
  { date: "Friday", revenuePaisa: 81245000, orderVolume: 142, label: "৳812k (142 orders)" },
];

const MOCK_CHART_30D: RevenueChartPoint[] = [
  { date: "Week 1", revenuePaisa: 280000000, orderVolume: 420, label: "৳2.80M (420 orders)" },
  { date: "Week 2", revenuePaisa: 340000000, orderVolume: 510, label: "৳3.40M (510 orders)" },
  { date: "Week 3", revenuePaisa: 390000000, orderVolume: 580, label: "৳3.90M (580 orders)" },
  { date: "Week 4", revenuePaisa: 489245000, orderVolume: 692, label: "৳4.89M (692 orders)" },
];

interface ToDoItem {
  id: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  date: string;
  completed: boolean;
}

const INITIAL_TODOS: ToDoItem[] = [
  {
    id: "todo-1",
    title: "Follow Up With New Pre-Orders",
    description: "Reach out to recently added wholesale bookings and verify advance bank deposit.",
    priority: "High",
    date: "May 21",
    completed: false,
  },
  {
    id: "todo-2",
    title: "Print Holographic Seals for Batch #495",
    description: "Perform 4-point electrical checks and print tamper-evident holographic serials.",
    priority: "Medium",
    date: "May 21",
    completed: false,
  },
  {
    id: "todo-3",
    title: "Update Customer Wholesale Profiles",
    description: "Review and organize enterprise client tax documents and verified phone badges.",
    priority: "Medium",
    date: "May 22",
    completed: true,
  },
];

const MOCK_ACTIVITIES: LiveActivityEvent[] = [
  {
    id: "ACT-01",
    timestamp: "May 12",
    type: "ORDER_PLACED",
    title: "New Drop-and-Pack Order #NCA-2026-84920",
    subtitle: "Jane Cooper (Mirpur-10) · TS101 Soldering Iron (2 units)",
    amountPaisa: 960000,
    badge: "Completed",
    badgeColor: "#15803d",
  },
  {
    id: "ACT-02",
    timestamp: "May 12",
    type: "RUNNER_PURCHASED",
    title: "Runner Shakil Mollah purchased at Al-Madina Stall",
    subtitle: "Devon Lane · Taher Tower Wholesale · Anker 735 GaNPrime",
    amountPaisa: 1160000,
    badge: "Pending",
    badgeColor: "#b45309",
  },
  {
    id: "ACT-03",
    timestamp: "May 11",
    type: "QC_PASSED",
    title: "QC Station approved Batch #BATCH-20261027-495",
    subtitle: "Floyd Miles · Holographic tamper seal affixed & verified",
    badge: "Completed",
    badgeColor: "#15803d",
  },
  {
    id: "ACT-04",
    timestamp: "May 10",
    type: "SEAL_VERIFIED",
    title: "Public Holographic Seal verified from Sylhet Sadar",
    subtitle: "Courtney Henry · Seal NCA-7K9W-2M4X · 100% Genuine",
    badge: "Completed",
    badgeColor: "#15803d",
  },
  {
    id: "ACT-05",
    timestamp: "May 09",
    type: "RMA_FILED",
    title: "New RMA Claim #RMA-2026-084 filed",
    subtitle: "Robert Fox · Defect video attached · 72h Doorstep SLA active",
    badge: "Pending",
    badgeColor: "#b45309",
  },
];

interface ExecutiveOverviewViewProps {
  currentRole?: AdminRole;
}

export function ExecutiveOverviewView({ currentRole = "SUPER_ADMIN" }: ExecutiveOverviewViewProps) {
  const [dateRange, setDateRange] = useState<"7D" | "30D">("7D");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [activities, setActivities] = useState<LiveActivityEvent[]>(MOCK_ACTIVITIES);
  const [todos, setTodos] = useState<ToDoItem[]>(INITIAL_TODOS);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePalette>(THEME_PRESETS[0]);

  // Load saved theme preference on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("nca_admin_theme_custom");
      if (savedTheme) {
        const parsed = JSON.parse(savedTheme) as ThemePalette;
        if (parsed && parsed.primary) {
          setTheme(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleApplyPreset = (preset: ThemePalette) => {
    setTheme(preset);
    try {
      localStorage.setItem("nca_admin_theme_custom", JSON.stringify(preset));
    } catch {
      // ignore
    }
  };

  const handleCustomColorChange = (key: keyof ThemePalette, color: string) => {
    const updated = { ...theme, [key]: color };
    setTheme(updated);
    try {
      localStorage.setItem("nca_admin_theme_custom", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleResetTheme = () => {
    handleApplyPreset(THEME_PRESETS[0]);
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  // Live order hydration
  useEffect(() => {
    let isMounted = true;
    fetch("/api/v1/admin/orders?limit=10", { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to load orders");
      })
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data.items) && data.items.length > 0) {
          const acts: LiveActivityEvent[] = data.items.slice(0, 5).map((o: { id: string; createdAt?: string; orderNumber?: string; status: string; customerPhone?: string; customerName?: string; totalPaisa?: number | string }, idx: number) => ({
            id: `ACT-${o.id.slice(0, 6)}`,
            timestamp: o.createdAt
              ? new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : `May ${12 - idx}`,
            type: "ORDER_PLACED",
            title: `Order #${o.orderNumber || o.id.slice(0, 8)} (${o.status})`,
            subtitle: `${o.customerPhone || o.customerName || "Customer"} · ৳${(Number(o.totalPaisa) / 100).toLocaleString()}`,
            amountPaisa: Number(o.totalPaisa) || 0,
            badge: o.status === "DELIVERED" ? "Completed" : "Pending",
            badgeColor: o.status === "DELIVERED" ? "#15803d" : "#b45309",
          }));
          setActivities(acts);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const chartData = dateRange === "7D" ? MOCK_CHART_7D : MOCK_CHART_30D;
  const maxRevenue = Math.max(...chartData.map((d) => d.revenuePaisa));

  // Compute SVG polygon coordinates for the area chart
  const chartWidth = 580;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 32;

  const points = chartData.map((d, index) => {
    const x = paddingX + (index / (chartData.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (d.revenuePaisa / maxRevenue) * (chartHeight - paddingY * 2);
    return { x, y, data: d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

  return (
    <div
      className="admin-clean-dashboard"
      data-testid="admin-overview-view"
      style={{
        backgroundColor: theme.canvasBg,
        color: theme.textColor,
        fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Top Header / Title Section */}
      <div className="dashboard-topbar">
        <div className="title-area">
          <div className="badge-row">
            <span className="live-dot" />
            <span className="live-tag">Nawabpur Operations Live Feed</span>
            <span className="role-tag">Role: {currentRole}</span>
          </div>
          <h1 className="main-title">Executive Operations Hub</h1>
          <p className="subtitle">Manager whole system here</p>
        </div>

        <div className="topbar-actions-cluster">
          {/* Quick Actions */}
          <Link href="/admin/catalog" className="clean-pill-btn btn-primary" style={{ backgroundColor: theme.primary }}>
            <span>+ New SKU</span>
          </Link>
          <Link href="/admin/qc" className="clean-pill-btn">
            <span>🖨️ Print Seals</span>
          </Link>
          <Link href="/admin/orders" className="clean-pill-btn">
            <span>📦 Dispatch Queue</span>
          </Link>

          {/* Color Customizer Toggle Button */}
          <button
            type="button"
            className="clean-pill-btn customizer-trigger-btn"
            onClick={() => setIsCustomizerOpen((v) => !v)}
            style={{
              borderColor: theme.primary,
              backgroundColor: isCustomizerOpen ? theme.primary : "transparent",
            }}
          >
            <span>🎨 Customize Colors</span>
          </button>
        </div>
      </div>

      {/* Interactive Color & Theme Customization Studio Section */}
      {isCustomizerOpen && (
        <section
          className="theme-customizer-panel"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.cardBorder,
          }}
        >
          <div className="customizer-header">
            <div>
              <h3 className="customizer-title">🎨 Color &amp; Theme Customization Studio</h3>
              <p className="customizer-sub">
                Choose clean pastel presets or personalize individual interface colors. Your preferences persist automatically.
              </p>
            </div>
            <button
              type="button"
              className="btn-reset"
              onClick={handleResetTheme}
              title="Reset to default Pistachio & Lime"
            >
              Reset to Default
            </button>
          </div>

          <div className="customizer-body">
            {/* Presets List */}
            <div className="presets-group">
              <span className="group-label">Color Presets:</span>
              <div className="presets-list">
                {THEME_PRESETS.map((p) => {
                  const isSelected = theme.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`preset-btn ${isSelected ? "selected" : ""}`}
                      onClick={() => handleApplyPreset(p)}
                      style={{
                        borderColor: isSelected ? theme.primary : theme.cardBorder,
                      }}
                    >
                      <span className="preset-swatches">
                        <span className="swatch" style={{ backgroundColor: p.primary }} />
                        <span className="swatch" style={{ backgroundColor: p.accentBlue }} />
                        <span className="swatch" style={{ backgroundColor: p.accentPeach }} />
                        <span className="swatch" style={{ backgroundColor: p.accentLavender }} />
                      </span>
                      <span className="preset-name">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="custom-pickers-group">
              <span className="group-label">Custom Palette Overrides:</span>
              <div className="pickers-grid">
                <label className="picker-item">
                  <span className="picker-label">Primary Accent</span>
                  <div className="picker-input-wrap">
                    <input
                      type="color"
                      value={theme.primary}
                      onChange={(e) => handleCustomColorChange("primary", e.target.value)}
                    />
                    <span className="hex-val">{theme.primary}</span>
                  </div>
                </label>

                <label className="picker-item">
                  <span className="picker-label">Sky Blue Accent</span>
                  <div className="picker-input-wrap">
                    <input
                      type="color"
                      value={theme.accentBlue}
                      onChange={(e) => handleCustomColorChange("accentBlue", e.target.value)}
                    />
                    <span className="hex-val">{theme.accentBlue}</span>
                  </div>
                </label>

                <label className="picker-item">
                  <span className="picker-label">Warm Peach Accent</span>
                  <div className="picker-input-wrap">
                    <input
                      type="color"
                      value={theme.accentPeach}
                      onChange={(e) => handleCustomColorChange("accentPeach", e.target.value)}
                    />
                    <span className="hex-val">{theme.accentPeach}</span>
                  </div>
                </label>

                <label className="picker-item">
                  <span className="picker-label">Lavender Accent</span>
                  <div className="picker-input-wrap">
                    <input
                      type="color"
                      value={theme.accentLavender}
                      onChange={(e) => handleCustomColorChange("accentLavender", e.target.value)}
                    />
                    <span className="hex-val">{theme.accentLavender}</span>
                  </div>
                </label>

                <label className="picker-item">
                  <span className="picker-label">Canvas Background</span>
                  <div className="picker-input-wrap">
                    <input
                      type="color"
                      value={theme.canvasBg}
                      onChange={(e) => handleCustomColorChange("canvasBg", e.target.value)}
                    />
                    <span className="hex-val">{theme.canvasBg}</span>
                  </div>
                </label>

                <label className="picker-item">
                  <span className="picker-label">Card Background</span>
                  <div className="picker-input-wrap">
                    <input
                      type="color"
                      value={theme.cardBg}
                      onChange={(e) => handleCustomColorChange("cardBg", e.target.value)}
                    />
                    <span className="hex-val">{theme.cardBg}</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4 Pastel Hero KPI Cards (Matching Image 1 & Image 2) */}
      <section className="kpi-hero-grid" aria-label="Key Performance Indicators">
        {/* Card 1: Gross Revenue (MTD) - Pastel Lime Green */}
        <div
          className="hero-kpi-card"
          data-testid="kpi-gross-revenue"
          style={{
            backgroundColor: theme.primary,
            color: "#151515",
          }}
        >
          <div className="hero-kpi-header">
            <span className="hero-kpi-icon-pill">💰 Invoices Awaiting Payment</span>
          </div>
          <div className="hero-kpi-row">
            <span className="hero-kpi-fraction">40/50</span>
            <span className="hero-kpi-subval">$5,900 (56%)</span>
          </div>
          <div className="hero-kpi-footer">
            <span className="hero-label">Gross Revenue (MTD)</span>
            <span className="hero-main-stat">{formatPaisa(MOCK_KPI.grossMerchandisePaisa)}</span>
            <span className="hero-trend-pill">↑ +{MOCK_KPI.grossRevenueGrowthPercent}% vs prev</span>
          </div>
        </div>

        {/* Card 2: Daily Drop-and-Pack - Pastel Warm Peach */}
        <div
          className="hero-kpi-card"
          data-testid="kpi-daily-orders"
          style={{
            backgroundColor: theme.accentPeach,
            color: "#151515",
          }}
        >
          <div className="hero-kpi-header">
            <span className="hero-kpi-icon-pill">📦 Converted Leads</span>
          </div>
          <div className="hero-kpi-row">
            <span className="hero-kpi-fraction">48/86</span>
            <span className="hero-kpi-subval">52 Completed (63%)</span>
          </div>
          <div className="hero-kpi-footer">
            <span className="hero-label">Daily Drop-and-Pack</span>
            <span className="hero-main-stat">{MOCK_KPI.dailyDropAndPackOrders} Orders</span>
            <span className="hero-trend-pill">↑ +{MOCK_KPI.dailyOrdersGrowthPercent}% today</span>
          </div>
        </div>

        {/* Card 3: Active Pre-Orders - Pastel Soft Blue */}
        <div
          className="hero-kpi-card"
          data-testid="kpi-pre-orders"
          style={{
            backgroundColor: theme.accentBlue,
            color: "#151515",
          }}
        >
          <div className="hero-kpi-header">
            <span className="hero-kpi-icon-pill">⚙️ Projects In Progress</span>
          </div>
          <div className="hero-kpi-row">
            <span className="hero-kpi-fraction">40/50</span>
            <span className="hero-kpi-subval">16 Completed (78%)</span>
          </div>
          <div className="hero-kpi-footer">
            <span className="hero-label">Active Pre-Orders</span>
            <span className="hero-main-stat">{MOCK_KPI.activePreOrdersCount} Units</span>
            <span className="hero-trend-pill">{formatPaisa(MOCK_KPI.activePreOrderQuotaPaisa)} quota</span>
          </div>
        </div>

        {/* Card 4: Courier RTO Rate & RMA - Pastel Lavender */}
        <div
          className="hero-kpi-card"
          data-testid="kpi-rto-rate"
          style={{
            backgroundColor: theme.accentLavender,
            color: "#151515",
          }}
        >
          <div className="hero-kpi-header">
            <span className="hero-kpi-icon-pill">📈 Conversion Rate</span>
          </div>
          <div className="hero-kpi-row">
            <span className="hero-kpi-fraction">46.59%</span>
            <span className="hero-kpi-subval">$2,254 (46%)</span>
          </div>
          <div className="hero-kpi-footer">
            <span className="hero-label">Courier RTO Rate</span>
            <span className="hero-main-stat">{(MOCK_KPI.rtoRateBasisPoints / 100).toFixed(2)}%</span>
            <span className="hero-trend-pill">Open RMA Claims: {MOCK_KPI.openRmaClaimsCount}</span>
          </div>
        </div>
      </section>

      {/* Main Grid: Payment Record (Left) & To-Do Items (Right) */}
      <div className="main-bento-grid">
        {/* Left Card: Payment Record / Revenue Chart */}
        <section
          className="clean-card chart-card"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.cardBorder,
          }}
        >
          <div className="card-header">
            <div>
              <h2 className="card-title">Payment Record</h2>
              <span className="card-sub">Revenue &amp; Fulfillment Volume across Nawabpur channels</span>
            </div>

            <div className="chart-controls-cluster">
              <div className="chart-legend-row">
                <span className="legend-indicator">
                  <span className="legend-color-box" style={{ backgroundColor: theme.primary }} />
                  Payment Awaited
                </span>
                <span className="legend-indicator">
                  <span className="legend-color-box" style={{ backgroundColor: theme.accentBlue }} />
                  Payment Completed
                </span>
              </div>

              <div className="timeframe-toggle">
                <button
                  type="button"
                  className={`toggle-tab ${dateRange === "7D" ? "active" : ""}`}
                  onClick={() => setDateRange("7D")}
                  style={{
                    backgroundColor: dateRange === "7D" ? theme.primary : "transparent",
                    color: "#151515",
                  }}
                  data-testid="toggle-chart-7d"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  className={`toggle-tab ${dateRange === "30D" ? "active" : ""}`}
                  onClick={() => setDateRange("30D")}
                  style={{
                    backgroundColor: dateRange === "30D" ? theme.primary : "transparent",
                    color: "#151515",
                  }}
                  data-testid="toggle-chart-30d"
                >
                  Last 30 Days
                </button>
              </div>
            </div>
          </div>

          {/* Clean Dual Bar & SVG Area Chart */}
          <div className="chart-area-container">
            {/* Visual Bars matching Image 1 */}
            <div className="bars-visualization-row">
              {chartData.map((d, idx) => {
                const heightPercentAwaited = Math.min(85, Math.max(20, (d.revenuePaisa / maxRevenue) * 80));
                const heightPercentCompleted = Math.min(95, Math.max(15, (d.orderVolume / 150) * 90));
                return (
                  <div
                    key={d.date}
                    className="bar-column-group"
                    onMouseEnter={() => setHoveredPointIndex(idx)}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                  >
                    <div className="dual-bars-track">
                      {/* Bar 1: Payment Awaited (Primary Accent) */}
                      <div
                        className="bar-pillar bar-awaited"
                        style={{
                          height: `${heightPercentAwaited}%`,
                          backgroundColor: theme.primary,
                        }}
                      />
                      {/* Bar 2: Payment Completed (Soft Blue) */}
                      <div
                        className="bar-pillar bar-completed"
                        style={{
                          height: `${heightPercentCompleted}%`,
                          backgroundColor: theme.accentBlue,
                        }}
                      />
                    </div>
                    <span className="bar-day-label">{d.date.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>

            {/* SVG Area Line Overlay */}
            <div className="svg-overlay-wrapper">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="revenue-svg"
                data-testid="revenue-area-chart"
              >
                <defs>
                  <linearGradient id="cleanAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.primary} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={theme.primary} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <path d={areaD} fill="url(#cleanAreaGradient)" />
                <path d={pathD} fill="none" stroke={theme.textColor} strokeWidth="2.5" strokeLinecap="round" />

                {points.map((p, idx) => (
                  <circle
                    key={p.data.date}
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPointIndex === idx ? 6 : 3.5}
                    fill={hoveredPointIndex === idx ? theme.primary : "#FFFFFF"}
                    stroke={theme.textColor}
                    strokeWidth="2"
                    style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                  />
                ))}
              </svg>
            </div>

            {/* Hover Tooltip */}
            {hoveredPointIndex !== null && (
              <div
                className="clean-tooltip"
                style={{
                  left: `${(points[hoveredPointIndex].x / chartWidth) * 100}%`,
                  top: `${(points[hoveredPointIndex].y / chartHeight) * 100}%`,
                }}
              >
                <div className="tooltip-date">{points[hoveredPointIndex].data.date}</div>
                <div className="tooltip-rev">{formatPaisa(points[hoveredPointIndex].data.revenuePaisa)}</div>
                <div className="tooltip-vol">{points[hoveredPointIndex].data.orderVolume} orders dispatched</div>
              </div>
            )}
          </div>
        </section>

        {/* Right Card: To-Do Items (Matching Image 1) */}
        <section
          className="clean-card todo-card"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.cardBorder,
          }}
        >
          <div className="card-header">
            <div>
              <h2 className="card-title">To-Do Items</h2>
              <span className="card-sub">All Ongoing To-Do Tasks</span>
            </div>
            <span className="todo-count-badge">{todos.filter((t) => !t.completed).length} Pending</span>
          </div>

          <div className="todo-list-wrap">
            {todos.map((item) => (
              <div
                key={item.id}
                className={`todo-item-row ${item.completed ? "completed" : ""}`}
                onClick={() => toggleTodo(item.id)}
              >
                <div className="todo-checkbox">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleTodo(item.id)}
                    aria-label={item.title}
                  />
                </div>
                <div className="todo-content">
                  <div className="todo-title">{item.title}</div>
                  <div className="todo-desc">{item.description}</div>
                  <div className="todo-meta-row">
                    <span
                      className="priority-pill"
                      style={{
                        backgroundColor:
                          item.priority === "High"
                            ? `${theme.primary}50`
                            : `${theme.accentBlue}50`,
                        color: "#151515",
                      }}
                    >
                      {item.priority}
                    </span>
                    <span className="todo-date">📅 {item.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-view-all-todos"
            style={{
              backgroundColor: theme.primary,
              color: "#151515",
            }}
          >
            View all items
          </button>
        </section>
      </div>

      {/* Secondary Bento Grid: Leads Overview Gauge & Latest Leads Table */}
      <div className="secondary-bento-grid">
        {/* Left Bottom Card: Leads Overview Radial Gauge (Matching Image 1) */}
        <section
          className="clean-card gauge-card"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.cardBorder,
          }}
        >
          <div className="card-header">
            <div>
              <h2 className="card-title">Leads Overview</h2>
              <span className="card-sub">Nawabpur runner sourcing &amp; pipeline</span>
            </div>
            <span className="filter-pill">Weekly ▾</span>
          </div>

          <div className="radial-gauge-container">
            <svg viewBox="0 0 200 130" className="radial-gauge-svg">
              <path
                d="M 25 115 A 75 75 0 0 1 65 38"
                fill="none"
                stroke={theme.accentLavender}
                strokeWidth="20"
                strokeLinecap="round"
              />
              <path
                d="M 72 32 A 75 75 0 0 1 128 32"
                fill="none"
                stroke={theme.accentBlue}
                strokeWidth="20"
                strokeLinecap="round"
              />
              <path
                d="M 135 38 A 75 75 0 0 1 175 115"
                fill="none"
                stroke={theme.primary}
                strokeWidth="20"
                strokeLinecap="round"
              />
            </svg>
            <div className="gauge-center-stat">
              <span className="gauge-number">20k</span>
              <span className="gauge-label">Total Leads</span>
            </div>
          </div>

          <div className="gauge-legend-row">
            <div className="legend-item">
              <span className="dot" style={{ backgroundColor: theme.accentLavender }} />
              <span>Sourced (35%)</span>
            </div>
            <div className="legend-item">
              <span className="dot" style={{ backgroundColor: theme.accentBlue }} />
              <span>QC Checked (40%)</span>
            </div>
            <div className="legend-item">
              <span className="dot" style={{ backgroundColor: theme.primary }} />
              <span>Delivered (25%)</span>
            </div>
          </div>
        </section>

        {/* Right Bottom Card: Latest Leads & Live Activity Table (Matching Image 1) */}
        <section
          className="clean-card latest-leads-card"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.cardBorder,
          }}
        >
          <div className="card-header">
            <div>
              <h2 className="card-title">Latest Leads</h2>
              <span className="card-sub">Real-time orders, runner purchases &amp; seals</span>
            </div>
            <span className="filter-pill">Last Month ▾</span>
          </div>

          <div className="leads-table-wrapper" data-testid="live-activity-feed">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Clients</th>
                  <th>Proposal &amp; Activity</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((act, index) => {
                  const initials = act.title
                    .replace(/[^a-zA-Z ]/g, "")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("") || "NC";
                  return (
                    <tr key={act.id}>
                      <td>
                        <div className="client-cell">
                          <div
                            className="client-avatar"
                            style={{
                              backgroundColor:
                                index % 3 === 0
                                  ? theme.primary
                                  : index % 3 === 1
                                  ? theme.accentBlue
                                  : theme.accentPeach,
                            }}
                          >
                            {initials}
                          </div>
                          <div className="client-meta">
                            <span className="client-name">{act.title.split("#")[0].trim() || act.title}</span>
                            <span className="client-sub">{act.subtitle.split("·")[0]?.trim() || "Wholesale Partner"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="activity-cell-wrap">
                          <span className="act-main-text">{act.title}</span>
                          {act.amountPaisa && (
                            <span className="act-amount-badge">{formatPaisa(act.amountPaisa)}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="date-text">{act.timestamp}</span>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${act.badge.toLowerCase().includes("complete") ? "status-completed" : "status-pending"}`}
                          style={{
                            backgroundColor:
                              act.badge.toLowerCase().includes("complete") || act.badge.toLowerCase().includes("qc")
                                ? `${theme.primary}60`
                                : `${theme.accentPeach}60`,
                            color: "#151515",
                          }}
                        >
                          {act.badge}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style jsx>{`
        .admin-clean-dashboard {
          padding: 28px 36px;
          min-height: 100vh;
          transition: background-color 0.25s ease, color 0.25s ease;
        }

        /* Topbar Header */
        .dashboard-topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .badge-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 8px rgba(22, 163, 74, 0.6);
        }

        .live-tag {
          font-size: 11px;
          font-weight: 700;
          color: #16a34a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .role-tag {
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          background: rgba(0, 0, 0, 0.05);
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .main-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin: 0 0 4px;
        }

        .subtitle {
          font-size: 13.5px;
          color: #6b7280;
          margin: 0;
        }

        .topbar-actions-cluster {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .clean-pill-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 9999px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #151515;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .clean-pill-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .btn-primary {
          border: none;
          color: #151515;
          font-weight: 700;
        }

        /* Color Customizer Studio */
        .theme-customizer-panel {
          border: 1px solid;
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 28px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .customizer-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          gap: 12px;
        }

        .customizer-title {
          font-size: 18px;
          font-weight: 800;
          margin: 0 0 4px;
        }

        .customizer-sub {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }

        .btn-reset {
          padding: 6px 14px;
          border-radius: 9999px;
          border: 1px solid #d1d5db;
          background: transparent;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .customizer-body {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .group-label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }

        .presets-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .preset-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          border-radius: 12px;
          border: 2px solid;
          background: #ffffff;
          color: #151515;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .preset-swatches {
          display: flex;
          gap: 3px;
        }

        .swatch {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .pickers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
        }

        .picker-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .picker-label {
          font-size: 12px;
          font-weight: 600;
        }

        .picker-input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .picker-input-wrap input[type="color"] {
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          cursor: pointer;
          background: transparent;
        }

        .hex-val {
          font-size: 11px;
          font-family: monospace;
          color: #6b7280;
          font-weight: 600;
        }

        /* 4 Pastel Hero KPI Cards */
        .kpi-hero-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 28px;
        }

        @media (max-width: 1024px) {
          .kpi-hero-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .kpi-hero-grid {
            grid-template-columns: 1fr;
          }
        }

        .hero-kpi-card {
          border-radius: 20px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .hero-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        }

        .hero-kpi-header {
          margin-bottom: 12px;
        }

        .hero-kpi-icon-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          background: rgba(0, 0, 0, 0.06);
          padding: 4px 10px;
          border-radius: 9999px;
        }

        .hero-kpi-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 12px;
        }

        .hero-kpi-fraction {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .hero-kpi-subval {
          font-size: 12.5px;
          font-weight: 600;
          opacity: 0.8;
        }

        .hero-kpi-footer {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: auto;
          padding-top: 10px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
        }

        .hero-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.75;
        }

        .hero-main-stat {
          font-size: 17px;
          font-weight: 800;
        }

        .hero-trend-pill {
          font-size: 11px;
          font-weight: 600;
          opacity: 0.85;
        }

        /* Bento Grids */
        .main-bento-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          margin-bottom: 28px;
        }

        @media (max-width: 960px) {
          .main-bento-grid {
            grid-template-columns: 1fr;
          }
        }

        .secondary-bento-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 20px;
        }

        @media (max-width: 960px) {
          .secondary-bento-grid {
            grid-template-columns: 1fr;
          }
        }

        .clean-card {
          border-radius: 20px;
          border: 1px solid;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          gap: 12px;
          flex-wrap: wrap;
        }

        .card-title {
          font-size: 18px;
          font-weight: 800;
          margin: 0 0 4px;
        }

        .card-sub {
          font-size: 12.5px;
          color: #6b7280;
        }

        .chart-controls-cluster {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .chart-legend-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .legend-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-color-box {
          width: 10px;
          height: 10px;
          border-radius: 3px;
        }

        .timeframe-toggle {
          display: flex;
          background: #f3f4f6;
          padding: 3px;
          border-radius: 9999px;
        }

        .toggle-tab {
          padding: 4px 12px;
          border-radius: 9999px;
          border: none;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        /* Chart Canvas & Dual Bars */
        .chart-area-container {
          position: relative;
          height: 240px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding-bottom: 24px;
        }

        .bars-visualization-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 180px;
          width: 100%;
          z-index: 1;
        }

        .bar-column-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .dual-bars-track {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 160px;
        }

        .bar-pillar {
          width: 16px;
          border-radius: 6px 6px 0 0;
          transition: height 0.3s ease, transform 0.15s ease;
        }

        .bar-column-group:hover .bar-pillar {
          transform: scaleY(1.04);
        }

        .bar-day-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
        }

        .svg-overlay-wrapper {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
        }

        .revenue-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .clean-tooltip {
          position: absolute;
          background: #151515;
          color: #ffffff;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 11.5px;
          pointer-events: none;
          transform: translate(-50%, -120%);
          white-space: nowrap;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
          z-index: 10;
        }

        .tooltip-date {
          font-weight: 700;
          margin-bottom: 2px;
        }

        .tooltip-rev {
          color: #bfe77d;
          font-weight: 800;
        }

        .tooltip-vol {
          font-size: 10.5px;
          color: #9ca3af;
        }

        /* To-Do Card */
        .todo-card {
          justify-content: space-between;
        }

        .todo-count-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 9999px;
          background: #f3f4f6;
          color: #4b5563;
        }

        .todo-list-wrap {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .todo-item-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          border-radius: 14px;
          background: #f9fafb;
          border: 1px solid #f3f4f6;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .todo-item-row:hover {
          background: #f3f4f6;
        }

        .todo-item-row.completed {
          opacity: 0.55;
        }

        .todo-item-row.completed .todo-title {
          text-decoration: line-through;
        }

        .todo-checkbox input {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          cursor: pointer;
          accent-color: #151515;
        }

        .todo-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .todo-title {
          font-size: 13.5px;
          font-weight: 700;
        }

        .todo-desc {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
        }

        .todo-meta-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
        }

        .priority-pill {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .todo-date {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 600;
        }

        .btn-view-all-todos {
          width: 100%;
          padding: 10px;
          border-radius: 12px;
          border: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .btn-view-all-todos:hover {
          transform: translateY(-1px);
        }

        /* Radial Gauge */
        .filter-pill {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          background: #f3f4f6;
          padding: 4px 10px;
          border-radius: 9999px;
        }

        .radial-gauge-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 16px 0;
        }

        .radial-gauge-svg {
          width: 180px;
          height: 120px;
        }

        .gauge-center-stat {
          position: absolute;
          bottom: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .gauge-number {
          font-size: 26px;
          font-weight: 800;
        }

        .gauge-label {
          font-size: 11.5px;
          color: #6b7280;
          font-weight: 600;
        }

        .gauge-legend-row {
          display: flex;
          justify-content: space-around;
          font-size: 11px;
          font-weight: 600;
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-item .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        /* Latest Leads Table */
        .leads-table-wrapper {
          overflow-x: auto;
        }

        .clean-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }

        .clean-table th {
          text-align: left;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #f3f4f6;
        }

        .clean-table td {
          padding: 12px;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }

        .clean-table tr:last-child td {
          border-bottom: none;
        }

        .client-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .client-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          color: #151515;
        }

        .client-meta {
          display: flex;
          flex-direction: column;
        }

        .client-name {
          font-weight: 700;
          font-size: 13px;
        }

        .client-sub {
          font-size: 11px;
          color: #6b7280;
        }

        .activity-cell-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .act-main-text {
          font-weight: 600;
        }

        .act-amount-badge {
          font-size: 11px;
          font-weight: 700;
          color: #059669;
        }

        .date-text {
          color: #6b7280;
          font-size: 12px;
        }

        .status-pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
