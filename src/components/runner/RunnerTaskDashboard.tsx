"use client";

import React, { useState } from "react";
import type { RunnerTask, RunnerProfile } from "./types";
import { RunnerTaskCard } from "./RunnerTaskCard";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";

const INITIAL_RUNNER: RunnerProfile = {
  id: "RUNNER-04",
  name: "Shakil Mollah",
  phone: "+880 1722-998877",
  role: "FIELD_RUNNER",
  shiftStatus: "ON_SHIFT",
  cashFloatPaisa: 1500000, // ৳15,000 opening float
  activeTasksCount: 3,
};

const INITIAL_TASKS: RunnerTask[] = [
  {
    id: "TASK-84920-01",
    orderNumber: "NCA-2026-84920",
    marketName: "Taher Tower Electrical Market",
    stallName: "Al-Madina Electronics Stall",
    stallNumber: "Shop #14 (2nd Floor)",
    stallContactPhone: "01712-345678",
    skuTitle: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
    skuCode: "ANK-735-65W",
    quantity: 1,
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
    targetWholesalePricePaisa: 380000,
    maxAllowedSpotPricePaisa: 410000,
    status: "ACCEPTED",
    assignedAt: "10:15 AM",
  },
  {
    id: "TASK-84921-02",
    orderNumber: "NCA-2026-84921",
    marketName: "Taher Tower Electrical Market",
    stallName: "Bismillah Tools & Meters",
    stallNumber: "Shop #08 (Ground Floor)",
    stallContactPhone: "01819-876543",
    skuTitle: "MINIWARE TS101 65W Smart Soldering Iron",
    skuCode: "MNW-TS101",
    quantity: 2,
    image: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80",
    targetWholesalePricePaisa: 580000,
    maxAllowedSpotPricePaisa: 620000,
    status: "AT_STALL",
    assignedAt: "10:20 AM",
  },
  {
    id: "TASK-84918-01",
    orderNumber: "NCA-2026-84918",
    marketName: "Nawabpur Road Hardware Lane",
    stallName: "Haji Cables & Accessories",
    stallNumber: "Lane 3, Shop #22",
    stallContactPhone: "01911-224466",
    skuTitle: "Baseus Tungsten Gold 240W Type-C Braided Cable (2m)",
    skuCode: "BAS-240W-CBL",
    quantity: 3,
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
    targetWholesalePricePaisa: 85000,
    maxAllowedSpotPricePaisa: 95000,
    negotiatedSpotPricePaisa: 85000,
    status: "PURCHASED",
    assignedAt: "09:45 AM",
  },
];

export function RunnerTaskDashboard() {
  const [runner, setRunner] = useState<RunnerProfile>(INITIAL_RUNNER);
  const [tasks, setTasks] = useState<RunnerTask[]>(INITIAL_TASKS);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PENDING" | "PURCHASED">("ALL");

  const { addToast } = useToast();

  const handleUpdateStatus = (
    taskId: string,
    nextStatus: RunnerTask["status"],
    negotiatedPricePaisa?: number
  ) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updated = {
            ...t,
            status: nextStatus,
            negotiatedSpotPricePaisa: negotiatedPricePaisa ?? t.negotiatedSpotPricePaisa,
          };

          // If purchased, deduct from cash float
          if (nextStatus === "PURCHASED" && negotiatedPricePaisa) {
            const purchaseTotal = negotiatedPricePaisa * t.quantity;
            setRunner((r) => ({
              ...r,
              cashFloatPaisa: Math.max(0, r.cashFloatPaisa - purchaseTotal),
            }));
          }

          return updated;
        }
        return t;
      })
    );
  };

  const handleRequestOverride = (taskId: string, spotPricePaisa: number) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "PRICE_OVERRIDE_PENDING",
              negotiatedSpotPricePaisa: spotPricePaisa,
              overrideStatus: "REQUESTED",
            }
          : t
      )
    );
  };

  const handleApproveOverrideSimulated = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const negotiatedPrice = t.negotiatedSpotPricePaisa || t.maxAllowedSpotPricePaisa;
          const purchaseTotal = negotiatedPrice * t.quantity;

          setRunner((r) => ({
            ...r,
            cashFloatPaisa: Math.max(0, r.cashFloatPaisa - purchaseTotal),
          }));

          return {
            ...t,
            status: "PURCHASED",
            overrideStatus: "APPROVED",
          };
        }
        return t;
      })
    );

    addToast({
      title: "Override Approved by Manager",
      description: "Sourcing Manager approved spot price. Task marked as Purchased.",
      variant: "success",
    });
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "PENDING") {
      return (
        t.status === "ASSIGNED" ||
        t.status === "ACCEPTED" ||
        t.status === "AT_STALL" ||
        t.status === "PRICE_OVERRIDE_PENDING"
      );
    }
    if (activeFilter === "PURCHASED") {
      return t.status === "PURCHASED" || t.status === "RETURNED_GODOWN";
    }
    return true;
  });

  // Group by Market
  const groupedTasks = filteredTasks.reduce<Record<string, RunnerTask[]>>((acc, t) => {
    if (!acc[t.marketName]) acc[t.marketName] = [];
    acc[t.marketName].push(t);
    return acc;
  }, {});

  const pendingCount = tasks.filter(
    (t) =>
      t.status === "ASSIGNED" ||
      t.status === "ACCEPTED" ||
      t.status === "AT_STALL" ||
      t.status === "PRICE_OVERRIDE_PENDING"
  ).length;

  const purchasedCount = tasks.filter(
    (t) => t.status === "PURCHASED" || t.status === "RETURNED_GODOWN"
  ).length;

  return (
    <div className="runner-pwa-container" data-testid="runner-task-dashboard">
      {/* Mobile PWA Shell Frame */}
      <div className="runner-pwa-phone">
        {/* Android PWA Top Header */}
        <header className="runner-pwa-header">
          <div className="header-status-row">
            <div className="role-tag">
              <span className="dot" />
              <span>FIELD_RUNNER</span>
            </div>
            <div className="shift-badge">
              <span>● {runner.shiftStatus === "ON_SHIFT" ? "ON DUTY" : "OFF DUTY"}</span>
            </div>
          </div>

          <div className="runner-profile-row">
            <div>
              <h1 className="runner-name">{runner.name}</h1>
              <span className="runner-phone">{runner.phone}</span>
            </div>

            <div className="float-pill">
              <span className="float-label">Cash in Hand</span>
              <span className="float-amount" data-testid="runner-float-amount">
                {formatPaisa(runner.cashFloatPaisa)}
              </span>
            </div>
          </div>

          {/* Zero Customer PII Security Assurance */}
          <div className="pii-security-banner">
            <span className="shield-icon">🛡️</span>
            <span>PRD §3.8 Zero Customer PII Protocol: Runner sees wholesale stalls only.</span>
          </div>

          {/* Sourcing Navigation Tabs */}
          <div className="task-filter-tabs">
            <button
              type="button"
              className={`filter-btn ${activeFilter === "ALL" ? "active" : ""}`}
              onClick={() => setActiveFilter("ALL")}
            >
              All Tasks ({tasks.length})
            </button>
            <button
              type="button"
              className={`filter-btn ${activeFilter === "PENDING" ? "active" : ""}`}
              onClick={() => setActiveFilter("PENDING")}
            >
              Pending Pickup ({pendingCount})
            </button>
            <button
              type="button"
              className={`filter-btn ${activeFilter === "PURCHASED" ? "active" : ""}`}
              onClick={() => setActiveFilter("PURCHASED")}
            >
              In Bag ({purchasedCount})
            </button>
          </div>
        </header>

        {/* Task List Grouped by Wholesale Market */}
        <main className="runner-task-list">
          {Object.keys(groupedTasks).length === 0 ? (
            <div className="empty-tasks-view">
              <span className="empty-icon">✅</span>
              <h3>No Tasks in this Filter</h3>
              <p>All items have been purchased and staged for godown intake.</p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([marketName, marketTasks]) => (
              <section key={marketName} className="market-group-section">
                <div className="market-header">
                  <span className="pin-icon">📍</span>
                  <h2 className="market-title">{marketName}</h2>
                  <span className="task-count-pill">{marketTasks.length} items</span>
                </div>

                <div className="tasks-cards-stack">
                  {marketTasks.map((t) => (
                    <RunnerTaskCard
                      key={t.id}
                      task={t}
                      onUpdateStatus={handleUpdateStatus}
                      onRequestOverride={handleRequestOverride}
                      onApproveOverrideSimulated={handleApproveOverrideSimulated}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </div>

      <style jsx>{`
        .runner-pwa-container {
          min-height: 100vh;
          background: #020617;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 0;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        /* Mobile viewport frame */
        .runner-pwa-phone {
          width: 100%;
          max-width: 480px;
          min-height: 100vh;
          background: #0b1329;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
        }

        /* Top Header */
        .runner-pwa-header {
          background: #0f172a;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 14px 16px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .role-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 800;
          color: #38bdf8;
          font-family: monospace;
          background: rgba(56, 189, 248, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .role-tag .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38bdf8;
        }

        .shift-badge {
          font-size: 10px;
          font-weight: 800;
          color: #10b981;
        }

        .runner-profile-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .runner-name {
          font-size: 18px;
          font-weight: 800;
          margin: 0;
          color: #f8fafc;
        }

        .runner-phone {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        .float-pill {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: 8px;
          padding: 6px 12px;
          text-align: right;
          display: flex;
          flex-direction: column;
        }

        .float-label {
          font-size: 10px;
          color: #a7f3d0;
          font-weight: 700;
        }

        .float-amount {
          font-size: 15px;
          font-weight: 900;
          color: #10b981;
        }

        .pii-security-banner {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 6px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          color: #94a3b8;
          margin-bottom: 12px;
        }

        .task-filter-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .filter-btn {
          padding: 8px 4px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          cursor: pointer;
          text-align: center;
        }

        .filter-btn.active {
          background: #f59e0b;
          color: #0f172a;
          border-color: #f59e0b;
        }

        /* Task List */
        .runner-task-list {
          flex: 1;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .market-group-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .market-header {
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 6px;
        }

        .pin-icon {
          font-size: 14px;
        }

        .market-title {
          font-size: 13px;
          font-weight: 800;
          color: #38bdf8;
          margin: 0;
          flex: 1;
        }

        .task-count-pill {
          font-size: 10px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          color: #cbd5e1;
        }

        .tasks-cards-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .empty-tasks-view {
          padding: 48px 16px;
          text-align: center;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          border: 1px dashed rgba(255, 255, 255, 0.1);
        }

        .empty-icon {
          font-size: 36px;
          margin-bottom: 8px;
          display: block;
        }

        .empty-tasks-view h3 {
          font-size: 15px;
          font-weight: 800;
          margin: 0 0 4px 0;
        }

        .empty-tasks-view p {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
