"use client";

import React, { useState } from "react";
import type { AdminOrderCardItem, AdminOrderStatus } from "./types";
import { KANBAN_COLUMNS, VALID_TRANSITIONS } from "./types";
import { MOCK_ADMIN_ORDERS } from "./mockData";
import { CourierDispatchConsole } from "./CourierDispatchConsole";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";

export function OrderKanbanBoard() {
  const [orders, setOrders] = useState<AdminOrderCardItem[]>(MOCK_ADMIN_ORDERS);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [shakingCardId, setShakingCardId] = useState<string | null>(null);

  const { addToast } = useToast();

  const handleAdvanceStatus = (orderId: string, targetStatus?: AdminOrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const currentStatus = order.status;
    const allowed = VALID_TRANSITIONS[currentStatus];

    const nextStatus = targetStatus || allowed[0];

    // Check valid state machine transition
    if (!allowed.includes(nextStatus)) {
      setShakingCardId(orderId);
      setTimeout(() => setShakingCardId(null), 600);

      addToast({
        title: "Invalid State Transition",
        description: `Cannot transition from ${currentStatus} directly to ${nextStatus}. Must follow strict fulfillment order.`,
        variant: "destructive",
      });
      return;
    }

    // Optimistic status update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );

    addToast({
      title: "Order Advanced",
      description: `Order ${order.orderNumber} advanced to ${nextStatus}.`,
      variant: "success",
    });
  };

  const handleDispatchSuccess = (
    dispatchedOrderIds: string[],
    courierName: string,
    consignmentPrefix: string
  ) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (dispatchedOrderIds.includes(o.id)) {
          return {
            ...o,
            status: "WITH_COURIER" as AdminOrderStatus,
            courierPartner: courierName as "Pathao" | "Steadfast",
            consignmentId: `${consignmentPrefix}-2026-${Math.floor(10000 + Math.random() * 90000)}`,
          };
        }
        return o;
      })
    );
  };

  const packedOrders = orders.filter((o) => o.status === "PACKED");
  const totalPipelinePaisa = orders.reduce((sum, o) => sum + o.totalPaisa, 0);

  return (
    <div className="kanban-view" data-testid="order-kanban-board">
      {/* Header Bar */}
      <div className="kanban-header">
        <div>
          <div className="kanban-pill">Operations Pipeline</div>
          <h1 className="kanban-title">Order Fulfillment Kanban Board</h1>
          <p className="kanban-sub">
            Drag-and-drop state machine tracking {orders.length} active orders ({formatPaisa(totalPipelinePaisa)} total value).
          </p>
        </div>

        <div className="kanban-actions">
          <button
            type="button"
            className="btn-open-dispatch"
            onClick={() => setIsDispatchModalOpen(true)}
            data-testid="btn-open-courier-dispatch"
          >
            <span>🚚 Bulk Courier Dispatch</span>
            {packedOrders.length > 0 && (
              <span className="dispatch-badge">{packedOrders.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="kanban-grid">
        {KANBAN_COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          const colTotalPaisa = colOrders.reduce((sum, o) => sum + o.totalPaisa, 0);

          return (
            <div
              key={col.status}
              className="kanban-col"
              data-testid={`kanban-col-${col.status}`}
            >
              {/* Column Header */}
              <div className="col-header" style={{ borderTopColor: col.color }}>
                <div className="col-title-row">
                  <span className="col-icon">{col.icon}</span>
                  <h3 className="col-title">{col.title}</h3>
                  <span className="col-count-pill">{colOrders.length}</span>
                </div>
                <div className="col-val-text">{formatPaisa(colTotalPaisa)}</div>
              </div>

              {/* Cards List */}
              <div className="col-cards-list">
                {colOrders.length === 0 ? (
                  <div className="empty-col-drop">
                    <span>No orders</span>
                  </div>
                ) : (
                  colOrders.map((order) => {
                    const isSlaBreached = order.slaAgeHours >= 4.0 && order.status === "PENDING_CONFIRMATION";
                    const isShaking = shakingCardId === order.id;

                    return (
                      <div
                        key={order.id}
                        className={`kanban-card ${isShaking ? "shake-anim" : ""} ${
                          isSlaBreached ? "sla-breach-card" : ""
                        }`}
                        data-testid={`kanban-card-${order.id}`}
                      >
                        {/* Top: Order # & SLA Timer */}
                        <div className="card-top-row">
                          <span className="card-order-num">{order.orderNumber}</span>
                          <span
                            className={`sla-timer-pill ${
                              isSlaBreached ? "sla-urgent" : "sla-ok"
                            }`}
                            data-testid="order-sla-timer"
                          >
                            ⏱️ {order.slaAgeHours}h age
                          </span>
                        </div>

                        {/* Customer & Destination */}
                        <div className="card-customer-row">
                          <span className="customer-name">{order.customerName}</span>
                          <span className="destination-tag">
                            📍 {order.division} ({order.district})
                          </span>
                        </div>

                        {/* Items Preview */}
                        <div className="card-items-preview">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="item-line">
                              <span className="item-qty">{item.quantity}x</span>
                              <span className="item-title">{item.skuTitle}</span>
                            </div>
                          ))}
                        </div>

                        {/* Financials & Badges */}
                        <div className="card-footer-row">
                          <span className="card-total">{formatPaisa(order.totalPaisa)}</span>

                          <div className="badges-group">
                            <span
                              className={`pay-badge ${
                                order.paymentStatus === "PAID" ? "badge-paid" : "badge-cod"
                              }`}
                            >
                              {order.paymentStatus === "PAID" ? "PAID" : "COD"}
                            </span>
                            <span
                              className={`tier-badge ${
                                order.tier === "AUTHENTIC" ? "badge-auth" : "badge-budget"
                              }`}
                            >
                              {order.tier === "AUTHENTIC" ? "100% Auth" : "Budget"}
                            </span>
                          </div>
                        </div>

                        {/* Advance Action Button */}
                        {VALID_TRANSITIONS[order.status].length > 0 && (
                          <div className="card-action-bar">
                            <button
                              type="button"
                              className="btn-advance"
                              onClick={() => handleAdvanceStatus(order.id)}
                              data-testid={`btn-advance-${order.id}`}
                            >
                              <span>Advance to {VALID_TRANSITIONS[order.status][0]} ➔</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Courier Dispatch Manifest Modal */}
      <CourierDispatchConsole
        isOpen={isDispatchModalOpen}
        packedOrders={packedOrders}
        onClose={() => setIsDispatchModalOpen(false)}
        onDispatchSuccess={handleDispatchSuccess}
      />

      <style jsx>{`
        .kanban-view {
          flex: 1;
          padding: 24px 32px;
          background: #020617;
          min-height: 100vh;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
          overflow-x: auto;
        }

        .kanban-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .kanban-pill {
          font-size: 10px;
          font-weight: 800;
          color: #38bdf8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .kanban-title {
          font-size: 24px;
          font-weight: 900;
          margin: 0 0 4px 0;
          letter-spacing: -0.4px;
        }

        .kanban-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .btn-open-dispatch {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 8px;
          background: #10b981;
          color: #022c22;
          font-size: 13px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          transition: transform 0.12s ease;
        }

        .btn-open-dispatch:hover {
          transform: translateY(-1px);
        }

        .dispatch-badge {
          background: #022c22;
          color: #34d399;
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 9999px;
        }

        /* Kanban Grid */
        .kanban-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(280px, 1fr));
          gap: 14px;
          align-items: flex-start;
          min-width: 1700px;
        }

        .kanban-col {
          background: #0b1329;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .col-header {
          padding: 12px 14px;
          background: #0f172a;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          border-top: 3px solid #38bdf8;
        }

        .col-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .col-icon {
          font-size: 14px;
        }

        .col-title {
          font-size: 13px;
          font-weight: 800;
          margin: 0;
          flex: 1;
          color: #f8fafc;
        }

        .col-count-pill {
          background: rgba(255, 255, 255, 0.1);
          font-size: 11px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 9999px;
          color: #cbd5e1;
        }

        .col-val-text {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        .col-cards-list {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 480px;
        }

        .empty-col-drop {
          padding: 32px 12px;
          text-align: center;
          font-size: 12px;
          color: #475569;
          border: 1px dashed rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        /* Order Card */
        .kanban-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: border-color 0.15s ease, transform 0.15s ease;
        }

        .kanban-card:hover {
          border-color: rgba(56, 189, 248, 0.4);
          transform: translateY(-2px);
        }

        .sla-breach-card {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
        }

        .card-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-order-num {
          font-size: 12px;
          font-weight: 900;
          color: #f8fafc;
          font-family: monospace;
        }

        .sla-timer-pill {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .sla-ok {
          background: rgba(255, 255, 255, 0.08);
          color: #94a3b8;
        }

        .sla-urgent {
          background: #ef4444;
          color: #fff;
          animation: pulse-breach 1.5s infinite;
        }

        @keyframes pulse-breach {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .card-customer-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .customer-name {
          font-size: 12px;
          font-weight: 700;
          color: #e2e8f0;
        }

        .destination-tag {
          font-size: 11px;
          color: #38bdf8;
        }

        .card-items-preview {
          background: rgba(0, 0, 0, 0.25);
          border-radius: 6px;
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .item-line {
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          gap: 6px;
        }

        .item-qty {
          color: #f59e0b;
          font-weight: 700;
        }

        .item-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 4px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .card-total {
          font-size: 13px;
          font-weight: 900;
          color: #f8fafc;
          font-family: monospace;
        }

        .badges-group {
          display: flex;
          gap: 4px;
        }

        .pay-badge,
        .tier-badge {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 5px;
          border-radius: 3px;
        }

        .badge-paid {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .badge-cod {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .badge-auth {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        .badge-budget {
          background: rgba(20, 184, 166, 0.15);
          color: #14b8a6;
        }

        .card-action-bar {
          margin-top: 4px;
        }

        .btn-advance {
          width: 100%;
          padding: 6px 10px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #38bdf8;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .btn-advance:hover {
          background: rgba(56, 189, 248, 0.15);
          border-color: #38bdf8;
        }

        /* Shake Animation */
        .shake-anim {
          animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @keyframes shake {
          10%, 90% { transform: translate3d(-2px, 0, 0); }
          20%, 80% { transform: translate3d(3px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-5px, 0, 0); }
          40%, 60% { transform: translate3d(5px, 0, 0); }
        }
      `}</style>
    </div>
  );
}
