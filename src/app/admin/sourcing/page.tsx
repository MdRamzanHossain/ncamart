"use client";

import React, { useState } from "react";
import Link from "next/link";

interface SourcingTaskItem {
  id: string;
  orderNumber: string;
  skuCode: string;
  productTitle: string;
  stallName: string;
  stallLocation: string;
  runnerName: string;
  expectedCostBdt: number;
  quotedCostBdt: number;
  qty: number;
  status: "ASSIGNED" | "OVERRIDE_REQUESTED" | "PURCHASED" | "QUARANTINED";
}

const INITIAL_SOURCING_TASKS: SourcingTaskItem[] = [
  {
    id: "TASK-SRC-901",
    orderNumber: "NCA-2026-84920",
    skuCode: "ANK-67W-GAN-BLK",
    productTitle: "Anker Prime 67W GaN Wall Charger (3 Ports)",
    stallName: "Al-Madina Electronics Importers",
    stallLocation: "Block B, 2nd Floor, Sundarban Square",
    runnerName: "Md. Rafiqul Islam (Runner #02)",
    expectedCostBdt: 3800,
    quotedCostBdt: 3800,
    qty: 2,
    status: "PURCHASED",
  },
  {
    id: "TASK-SRC-902",
    orderNumber: "NCA-2026-84955",
    skuCode: "MEC-T12X-PRO",
    productTitle: "Mechanic T12-X Intelligent Digital Soldering Station",
    stallName: "Nawabpur Machinery & Tools Syndicate",
    stallLocation: "Shop 118, Kaptan Bazar Complex",
    runnerName: "Kamrul Hasan (Runner #01)",
    expectedCostBdt: 2450,
    quotedCostBdt: 2680,
    qty: 1,
    status: "OVERRIDE_REQUESTED",
  },
  {
    id: "TASK-SRC-903",
    orderNumber: "NCA-2026-85012",
    skuCode: "BAS-100W-TYPEC-18M",
    productTitle: "Baseus 100W PD 5A E-Marker Braided Cable (1.8m)",
    stallName: "Dhaka Telecom Wholesale",
    stallLocation: "Lane 4, Nawabpur Tower",
    runnerName: "Md. Rafiqul Islam (Runner #02)",
    expectedCostBdt: 680,
    quotedCostBdt: 680,
    qty: 5,
    status: "QUARANTINED",
  },
];

export default function AdminSourcingPage() {
  const [tasks, setTasks] = useState<SourcingTaskItem[]>(INITIAL_SOURCING_TASKS);

  const handleDecision = (id: string, newStatus: SourcingTaskItem["status"]) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  };

  return (
    <div style={{ padding: "24px", color: "#f8fafc", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#f59e0b",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            NAWABPUR DROP-AND-PACK SOURCING ENGINE
          </span>
          <h1 style={{ fontSize: "24px", fontWeight: 900, margin: "4px 0" }}>
            Field Runner Sourcing & Cash Float Console
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            Supervise real-time wholesale stall runs, approve &gt;5% price variance overrides, and clear quarantined batch receipts.
          </p>
        </div>

        <Link
          href="/runner"
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            backgroundColor: "#f59e0b",
            color: "#0b0f19",
            fontWeight: 800,
            fontSize: "12px",
            textDecoration: "none",
          }}
        >
          📱 Open Field Runner Mobile PWA (/runner) →
        </Link>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
            Active Field Runners
          </div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#38bdf8", marginTop: "4px" }}>4 Active</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Sundarban Sq & Kaptan Bazar</div>
        </div>

        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
            Issued Cash Float Today
          </div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#10b981", marginTop: "4px" }}>৳85,000</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>৳52,400 Vouchered · ৳32,600 In Hand</div>
        </div>

        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
            Price Variance Overrides
          </div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#f59e0b", marginTop: "4px" }}>
            {tasks.filter((t) => t.status === "OVERRIDE_REQUESTED").length} Pending
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>&gt;5% stall cost threshold</div>
        </div>

        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
            Quarantine Inspection
          </div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#f87171", marginTop: "4px" }}>
            {tasks.filter((t) => t.status === "QUARANTINED").length} Batch
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Awaiting Godown supervisor review</div>
        </div>
      </div>

      {/* Tasks Table */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #334155", fontWeight: 800, fontSize: "14px" }}>
          Live Wholesale Stall Runs & Override Queue
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#0f172a", color: "#94a3b8", textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px" }}>Task / Order</th>
                <th style={{ padding: "12px 16px" }}>SKU & Product</th>
                <th style={{ padding: "12px 16px" }}>Wholesale Stall</th>
                <th style={{ padding: "12px 16px" }}>Assigned Runner</th>
                <th style={{ padding: "12px 16px" }}>Expected vs Quoted</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} style={{ borderTop: "1px solid #334155" }}>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700 }}>
                    <div>{task.id}</div>
                    <div style={{ fontSize: "11px", color: "#38bdf8" }}>#{task.orderNumber}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 700 }}>{task.productTitle}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      SKU: {task.skuCode} · Qty: {task.qty}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 600 }}>{task.stallName}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>{task.stallLocation}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>{task.runnerName}</td>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace" }}>
                    <div>Exp: ৳{task.expectedCostBdt}</div>
                    <div style={{ color: task.quotedCostBdt > task.expectedCostBdt ? "#f59e0b" : "#10b981", fontWeight: 700 }}>
                      Quoted: ৳{task.quotedCostBdt}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 800,
                        backgroundColor:
                          task.status === "PURCHASED"
                            ? "rgba(16, 185, 129, 0.2)"
                            : task.status === "OVERRIDE_REQUESTED"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                        color:
                          task.status === "PURCHASED"
                            ? "#10b981"
                            : task.status === "OVERRIDE_REQUESTED"
                            ? "#f59e0b"
                            : "#f87171",
                      }}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {task.status !== "PURCHASED" ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => handleDecision(task.id, "PURCHASED")}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "6px",
                            border: "none",
                            backgroundColor: "#10b981",
                            color: "#0b0f19",
                            fontWeight: 800,
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#64748b" }}> Handed to QC</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

