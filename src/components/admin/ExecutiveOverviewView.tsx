"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { AdminKpiStats, RevenueChartPoint, LiveActivityEvent, AdminRole } from "./types";
import { formatPaisa } from "@/lib/money";

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
  { date: "Oct 21", revenuePaisa: 54000000, orderVolume: 82, label: "৳540k (82 orders)" },
  { date: "Oct 22", revenuePaisa: 62000000, orderVolume: 96, label: "৳620k (96 orders)" },
  { date: "Oct 23", revenuePaisa: 58000000, orderVolume: 89, label: "৳580k (89 orders)" },
  { date: "Oct 24", revenuePaisa: 71000000, orderVolume: 114, label: "৳710k (114 orders)" },
  { date: "Oct 25", revenuePaisa: 84000000, orderVolume: 130, label: "৳840k (130 orders)" },
  { date: "Oct 26", revenuePaisa: 79000000, orderVolume: 122, label: "৳790k (122 orders)" },
  { date: "Oct 27", revenuePaisa: 81245000, orderVolume: 142, label: "৳812k (142 orders)" },
];

const MOCK_CHART_30D: RevenueChartPoint[] = [
  { date: "Week 1", revenuePaisa: 280000000, orderVolume: 420, label: "৳2.80M (420 orders)" },
  { date: "Week 2", revenuePaisa: 340000000, orderVolume: 510, label: "৳3.40M (510 orders)" },
  { date: "Week 3", revenuePaisa: 390000000, orderVolume: 580, label: "৳3.90M (580 orders)" },
  { date: "Week 4", revenuePaisa: 489245000, orderVolume: 692, label: "৳4.89M (692 orders)" },
];

const MOCK_ACTIVITIES: LiveActivityEvent[] = [
  {
    id: "ACT-01",
    timestamp: "2 mins ago",
    type: "ORDER_PLACED",
    title: "New Drop-and-Pack Order #NCA-2026-84920",
    subtitle: "Customer in Mirpur-10 · 2 items · SSLCommerz Paid",
    amountPaisa: 960000,
    badge: "NEW ORDER",
    badgeColor: "#38bdf8",
  },
  {
    id: "ACT-02",
    timestamp: "7 mins ago",
    type: "RUNNER_PURCHASED",
    title: "Runner Shakil Mollah purchased at Al-Madina Stall",
    subtitle: "Taher Tower Market · TS101 Soldering Iron (2 units)",
    amountPaisa: 1160000,
    badge: "SPOT SOURCED",
    badgeColor: "#f59e0b",
  },
  {
    id: "ACT-03",
    timestamp: "14 mins ago",
    type: "QC_PASSED",
    title: "QC Station approved Batch #BATCH-20261027-495",
    subtitle: "Destructive holographic seal applied · Ready for courier pack",
    badge: "QC PASSED",
    badgeColor: "#10b981",
  },
  {
    id: "ACT-04",
    timestamp: "28 mins ago",
    type: "SEAL_VERIFIED",
    title: "Public Holographic Seal verified from Sylhet Sadar",
    subtitle: "Seal NCA-7K9W-2M4X · 100% Genuine Authentic Anker 735",
    badge: "SEAL VERIFIED",
    badgeColor: "#a855f7",
  },
  {
    id: "ACT-05",
    timestamp: "45 mins ago",
    type: "RMA_FILED",
    title: "New RMA Claim #RMA-2026-084 filed",
    subtitle: "Defect demonstration video uploaded · 72h Doorstep SLA active",
    badge: "RMA CLAIM",
    badgeColor: "#ef4444",
  },
];

interface ExecutiveOverviewViewProps {
  currentRole?: AdminRole;
}

export function ExecutiveOverviewView({ currentRole = "SUPER_ADMIN" }: ExecutiveOverviewViewProps) {
  const [dateRange, setDateRange] = useState<"7D" | "30D">("7D");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [activities, setActivities] = useState<LiveActivityEvent[]>(MOCK_ACTIVITIES);

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
          const acts: LiveActivityEvent[] = data.items.slice(0, 5).map((o: any) => ({
            id: `ACT-${o.id.slice(0, 6)}`,
            timestamp: o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now",
            type: "ORDER_PLACED",
            title: `Order #${o.orderNumber || o.id.slice(0, 8)} (${o.status})`,
            subtitle: `Customer: ${o.customerPhone || o.customerName || "Customer"} · ৳${(Number(o.totalPaisa) / 100).toLocaleString()}`,
            amountPaisa: Number(o.totalPaisa) || 0,
            badge: o.status,
            badgeColor: o.status === "DELIVERED" ? "#22c55e" : "#38bdf8",
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
  const chartWidth = 560;
  const chartHeight = 160;
  const paddingX = 40;
  const paddingY = 20;

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
    <div className="admin-overview-container" data-testid="admin-overview-view">
      {/* Top Bar Header */}
      <header className="overview-header">
        <div>
          <div className="header-badge-row">
            <span className="live-dot" />
            <span className="live-tag">Nawabpur Operations Live Feed</span>
            <span className="role-tag">Role: {currentRole}</span>
          </div>
          <h1 className="header-title">Executive Operations Hub</h1>
          <p className="header-sub">
            Real-time monitoring of drop-and-pack sourcing, godown seals, and financial metrics.
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="quick-actions-bar">
          <Link href="/admin/catalog" className="action-btn btn-primary">
            <span>+ New SKU</span>
          </Link>
          <Link href="/admin/qc" className="action-btn">
            <span>🖨️ Print Seals</span>
          </Link>
          <Link href="/admin/orders" className="action-btn">
            <span>📦 Dispatch Queue</span>
          </Link>
          <Link href="/admin/security" className="action-btn">
            <span>🛡️ Audit Logs</span>
          </Link>
        </div>
      </header>

      {/* 5 Executive KPI Metric Cards */}
      <section className="kpi-metrics-grid" aria-label="Key Performance Indicators">
        {/* Card 1: Gross Revenue */}
        <div className="kpi-card" data-testid="kpi-gross-revenue">
          <div className="kpi-header">
            <span className="kpi-title">Gross Revenue (MTD)</span>
            <span className="kpi-icon">💰</span>
          </div>
          <div className="kpi-value">{formatPaisa(MOCK_KPI.grossMerchandisePaisa)}</div>
          <div className="kpi-trend trend-positive">
            <span>↑ +{MOCK_KPI.grossRevenueGrowthPercent}%</span>
            <span className="trend-sub">vs previous 30 days</span>
          </div>
        </div>

        {/* Card 2: Daily Drop-and-Pack Orders */}
        <div className="kpi-card" data-testid="kpi-daily-orders">
          <div className="kpi-header">
            <span className="kpi-title">Daily Drop-and-Pack</span>
            <span className="kpi-icon">📦</span>
          </div>
          <div className="kpi-value">{MOCK_KPI.dailyDropAndPackOrders} Orders</div>
          <div className="kpi-trend trend-positive">
            <span>↑ +{MOCK_KPI.dailyOrdersGrowthPercent}%</span>
            <span className="trend-sub">today vs yesterday</span>
          </div>
        </div>

        {/* Card 3: Active Pre-Orders */}
        <div className="kpi-card" data-testid="kpi-pre-orders">
          <div className="kpi-header">
            <span className="kpi-title">Active Pre-Orders</span>
            <span className="kpi-icon">✈️</span>
          </div>
          <div className="kpi-value">{MOCK_KPI.activePreOrdersCount} Reserved</div>
          <div className="kpi-trend">
            <span className="quota-tag">{formatPaisa(MOCK_KPI.activePreOrderQuotaPaisa)}</span>
            <span className="trend-sub">landed value</span>
          </div>
        </div>

        {/* Card 4: RTO Rate */}
        <div className="kpi-card" data-testid="kpi-rto-rate">
          <div className="kpi-header">
            <span className="kpi-title">Courier RTO Rate</span>
            <span className="kpi-icon">🚚</span>
          </div>
          <div className="kpi-value">{(MOCK_KPI.rtoRateBasisPoints / 100).toFixed(2)}%</div>
          <div className="kpi-trend trend-positive">
            <span className="badge-healthy">HEALTHY &lt; 3.0%</span>
            <span className="trend-sub">Dhaka &amp; National</span>
          </div>
        </div>

        {/* Card 5: Open RMA Claims */}
        <div className="kpi-card" data-testid="kpi-open-rma">
          <div className="kpi-header">
            <span className="kpi-title">Open RMA Claims</span>
            <span className="kpi-icon">🛡️</span>
          </div>
          <div className="kpi-value">{MOCK_KPI.openRmaClaimsCount} Claims</div>
          <div className="kpi-trend trend-warning">
            <span>⚠️ {MOCK_KPI.unresolvedRmaAlerts} Urgent Review</span>
            <span className="trend-sub">72h SLA Active</span>
          </div>
        </div>
      </section>

      {/* Main Grid: Revenue Area Chart & Live Activity Ticker */}
      <div className="overview-main-grid">
        {/* Left Column: Interactive Revenue & Volume Area Chart */}
        <section className="chart-panel" aria-label="Revenue and Order Volume Trends">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Revenue &amp; Fulfillment Volume</h2>
              <span className="panel-sub">Integer Paisa precision across Nawabpur wholesale channels</span>
            </div>

            <div className="chart-filter-toggle">
              <button
                type="button"
                className={`toggle-btn ${dateRange === "7D" ? "active" : ""}`}
                onClick={() => setDateRange("7D")}
                data-testid="toggle-chart-7d"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                className={`toggle-btn ${dateRange === "30D" ? "active" : ""}`}
                onClick={() => setDateRange("30D")}
                data-testid="toggle-chart-30d"
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {/* SVG Area Chart */}
          <div className="chart-canvas-wrapper">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="revenue-svg"
              data-testid="revenue-area-chart"
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={paddingX}
                y1={chartHeight - paddingY}
                x2={chartWidth - paddingX}
                y2={chartHeight - paddingY}
                stroke="rgba(255,255,255,0.08)"
              />
              <line
                x1={paddingX}
                y1={paddingY}
                x2={chartWidth - paddingX}
                y2={paddingY}
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="4"
              />

              {/* Area & Stroke */}
              <path d={areaD} fill="url(#areaGradient)" />
              <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />

              {/* Points */}
              {points.map((p, idx) => (
                <g
                  key={p.data.date}
                  className="chart-dot-group"
                  onMouseEnter={() => setHoveredPointIndex(idx)}
                  onMouseLeave={() => setHoveredPointIndex(null)}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPointIndex === idx ? 6 : 4}
                    fill={hoveredPointIndex === idx ? "#ffffff" : "#f59e0b"}
                    stroke="#0f172a"
                    strokeWidth="2"
                    style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                  />
                  <text
                    x={p.x}
                    y={chartHeight - 4}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {p.data.date}
                  </text>
                </g>
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPointIndex !== null && (
              <div
                className="chart-tooltip"
                style={{
                  left: `${(points[hoveredPointIndex].x / chartWidth) * 100}%`,
                  top: `${(points[hoveredPointIndex].y / chartHeight) * 100}%`,
                }}
              >
                <div className="tooltip-date">{points[hoveredPointIndex].data.date}</div>
                <div className="tooltip-rev">
                  {formatPaisa(points[hoveredPointIndex].data.revenuePaisa)}
                </div>
                <div className="tooltip-vol">
                  {points[hoveredPointIndex].data.orderVolume} orders dispatched
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Live Operational Activity Ticker */}
        <section className="activity-panel" aria-label="Live Operations Feed">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Live Activity Ticker</h2>
              <span className="panel-sub">Real-time orders, runner purchases &amp; seals</span>
            </div>
            <span className="event-count-badge">Live</span>
          </div>

          <div className="activity-list" data-testid="live-activity-feed">
            {activities.map((act) => (
              <div key={act.id} className="activity-item">
                <div className="activity-top">
                  <span
                    className="act-badge"
                    style={{
                      background: `${act.badgeColor}20`,
                      color: act.badgeColor,
                      borderColor: `${act.badgeColor}40`,
                    }}
                  >
                    {act.badge}
                  </span>
                  <span className="act-time">{act.timestamp}</span>
                </div>

                <div className="act-title">{act.title}</div>
                <div className="act-sub">{act.subtitle}</div>

                {act.amountPaisa && (
                  <div className="act-amount">{formatPaisa(act.amountPaisa)}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <style jsx>{`
        .admin-overview-container {
          flex: 1;
          padding: 24px 32px;
          background: #020617;
          min-height: 100vh;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
          overflow-y: auto;
        }

        /* Header */
        .overview-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-badge-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
        }

        .live-tag {
          font-size: 11px;
          font-weight: 800;
          color: #10b981;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .role-tag {
          font-size: 10px;
          font-weight: 800;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }

        .header-title {
          font-size: 26px;
          font-weight: 900;
          margin: 0 0 4px 0;
          color: #f8fafc;
          letter-spacing: -0.5px;
        }

        .header-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .quick-actions-bar {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-btn {
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #e2e8f0;
          text-decoration: none;
          transition: background 0.12s ease, transform 0.12s ease;
        }

        .action-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .action-btn.btn-primary {
          background: #f59e0b;
          color: #0f172a;
          border-color: #f59e0b;
        }

        .action-btn.btn-primary:hover {
          background: #fbbf24;
        }

        /* KPI Metrics Grid */
        .kpi-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .kpi-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: border-color 0.15s ease;
        }

        .kpi-card:hover {
          border-color: rgba(245, 158, 11, 0.4);
        }

        .kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .kpi-title {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .kpi-icon {
          font-size: 16px;
        }

        .kpi-value {
          font-size: 22px;
          font-weight: 900;
          color: #f8fafc;
          letter-spacing: -0.3px;
        }

        .kpi-trend {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
        }

        .trend-positive {
          color: #10b981;
        }

        .trend-warning {
          color: #f59e0b;
        }

        .trend-sub {
          color: #64748b;
          font-weight: 500;
        }

        .quota-tag {
          color: #38bdf8;
          font-weight: 800;
        }

        .badge-healthy {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
        }

        /* Overview Main Grid */
        .overview-main-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
        }

        @media (max-width: 1024px) {
          .overview-main-grid {
            grid-template-columns: 1fr;
          }
        }

        .chart-panel,
        .activity-panel {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .panel-title {
          font-size: 15px;
          font-weight: 800;
          margin: 0;
          color: #f8fafc;
        }

        .panel-sub {
          font-size: 11px;
          color: #64748b;
        }

        .chart-filter-toggle {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          padding: 3px;
          border-radius: 8px;
          gap: 2px;
        }

        .toggle-btn {
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }

        .toggle-btn.active {
          background: #1e293b;
          color: #f59e0b;
        }

        .chart-canvas-wrapper {
          position: relative;
          width: 100%;
          min-height: 180px;
        }

        .revenue-svg {
          width: 100%;
          height: 180px;
          overflow: visible;
        }

        .chart-tooltip {
          position: absolute;
          transform: translate(-50%, -120%);
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 8px 12px;
          pointer-events: none;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
          white-space: nowrap;
          z-index: 10;
        }

        .tooltip-date {
          font-size: 10px;
          color: #94a3b8;
        }

        .tooltip-rev {
          font-size: 14px;
          font-weight: 900;
          color: #f59e0b;
        }

        .tooltip-vol {
          font-size: 10px;
          color: #cbd5e1;
        }

        /* Activity Feed */
        .event-count-badge {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 9999px;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 380px;
          overflow-y: auto;
        }

        .activity-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .activity-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .act-badge {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        .act-time {
          font-size: 10px;
          color: #64748b;
        }

        .act-title {
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
        }

        .act-sub {
          font-size: 11px;
          color: #94a3b8;
        }

        .act-amount {
          font-size: 11px;
          font-weight: 800;
          color: #10b981;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
