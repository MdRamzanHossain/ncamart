"use client";

import React, { useState } from "react";
import Link from "next/link";

interface RmaSupportTicket {
  claimNumber: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  productTitle: string;
  sealId: string;
  reason: string;
  status: "SUBMITTED" | "INSPECTING_AT_GODOWN" | "APPROVED_REPLACEMENT" | "CREDITED_TO_WALLET";
  amountBdt: number;
}

const INITIAL_TICKETS: RmaSupportTicket[] = [
  {
    claimNumber: "RMA-2026-0412",
    orderNumber: "NCA-2026-77142",
    customerName: "Engr. Tanvir Ahmed",
    customerPhone: "+880 1712-345678",
    productTitle: "Mechanic T12-X Intelligent Digital Soldering Station",
    sealId: "NCA-9X4K-2M7B",
    reason: "DOA — OLED screen flicker on 24V bench load",
    status: "INSPECTING_AT_GODOWN",
    amountBdt: 3200,
  },
  {
    claimNumber: "RMA-2026-0419",
    orderNumber: "NCA-2026-81204",
    customerName: "Sadia Rahman",
    customerPhone: "+880 1819-554433",
    productTitle: "Baseus GaN5 Pro 65W Fast Charger",
    sealId: "NCA-3P9L-8K2D",
    reason: "Type-C Port #2 intermittent PD handshake",
    status: "SUBMITTED",
    amountBdt: 3450,
  },
];

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<RmaSupportTicket[]>(INITIAL_TICKETS);

  const handleResolve = (claimNumber: string, status: RmaSupportTicket["status"]) => {
    setTickets((prev) => prev.map((t) => (t.claimNumber === claimNumber ? { ...t, status } : t)));
  };

  return (
    <div style={{ padding: "24px", color: "#f8fafc", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#38bdf8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            WARRANTY ADJUDICATION & CUSTOMER CARE
          </span>
          <h1 style={{ fontSize: "24px", fontWeight: 900, margin: "4px 0" }}>
            Customer Support & RMA Claims Desk
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            Inspect holographic seal integrity on returned units, adjudicate DOA warranty claims, and issue instant Store Credit refunds.
          </p>
        </div>

        <Link
          href="/verify"
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            backgroundColor: "#3b82f6",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "12px",
            textDecoration: "none",
          }}
        >
          🛡️ Verify Returned Seal Code →
        </Link>
      </div>

      {/* Claims Table */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #334155", fontWeight: 800, fontSize: "14px" }}>
          Active RMA Warranty Claims & Seal Verifications
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#0f172a", color: "#94a3b8", textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px" }}>Claim / Order</th>
                <th style={{ padding: "12px 16px" }}>Customer</th>
                <th style={{ padding: "12px 16px" }}>Product & Seal</th>
                <th style={{ padding: "12px 16px" }}>Reported Issue</th>
                <th style={{ padding: "12px 16px" }}>Value</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Resolution</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.claimNumber} style={{ borderTop: "1px solid #334155" }}>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700 }}>
                    <div>{t.claimNumber}</div>
                    <div style={{ fontSize: "11px", color: "#38bdf8" }}>#{t.orderNumber}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 700 }}>{t.customerName}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>{t.customerPhone}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 600 }}>{t.productTitle}</div>
                    <div style={{ fontSize: "11px", color: "#f59e0b", fontFamily: "monospace" }}>
                      Seal: {t.sealId}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#cbd5e1" }}>{t.reason}</td>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700 }}>
                    ৳{t.amountBdt.toLocaleString()}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 800,
                        backgroundColor: "rgba(56, 189, 248, 0.18)",
                        color: "#38bdf8",
                      }}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => handleResolve(t.claimNumber, "CREDITED_TO_WALLET")}
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
                        Credit Wallet
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolve(t.claimNumber, "APPROVED_REPLACEMENT")}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid #475569",
                          backgroundColor: "transparent",
                          color: "#f8fafc",
                          fontWeight: 700,
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Replace Unit
                      </button>
                    </div>
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

