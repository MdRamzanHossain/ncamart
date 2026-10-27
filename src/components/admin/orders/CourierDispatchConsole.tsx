"use client";

import React, { useState } from "react";
import type { AdminOrderCardItem } from "./types";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";

interface CourierDispatchConsoleProps {
  isOpen: boolean;
  packedOrders: AdminOrderCardItem[];
  onClose: () => void;
  onDispatchSuccess: (dispatchedOrderIds: string[], courierName: string, consignmentPrefix: string) => void;
}

export function CourierDispatchConsole({
  isOpen,
  packedOrders,
  onClose,
  onDispatchSuccess,
}: CourierDispatchConsoleProps) {
  const { addToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>(packedOrders.map((o) => o.id));
  const [courier, setCourier] = useState<"Pathao" | "Steadfast">("Pathao");
  const [isBooking, setIsBooking] = useState(false);
  const [generatedManifest, setGeneratedManifest] = useState<{
    manifestId: string;
    consignments: { orderNumber: string; consignmentId: string; customer: string; codPaisa: number }[];
  } | null>(null);

  if (!isOpen) return null;

  const handleToggleOrder = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleGenerateConsignments = () => {
    if (selectedIds.length === 0) {
      addToast({
        title: "No Orders Selected",
        description: "Select at least one packed order to generate courier dispatch manifest.",
        variant: "destructive",
      });
      return;
    }

    setIsBooking(true);

    setTimeout(() => {
      const manifestId = `MNF-${courier.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;
      const prefix = courier === "Pathao" ? "PTH" : "STF";

      const consignments = selectedIds.map((id, index) => {
        const order = packedOrders.find((o) => o.id === id);
        const consignmentId = `${prefix}-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        return {
          orderNumber: order?.orderNumber || `ORD-${id}`,
          consignmentId,
          customer: order?.customerName || "Customer",
          codPaisa: order?.paymentStatus === "COD_PENDING" ? order.totalPaisa : 0,
        };
      });

      setGeneratedManifest({ manifestId, consignments });
      setIsBooking(false);

      onDispatchSuccess(selectedIds, courier, prefix);

      addToast({
        title: "Manifest Booked with Courier API",
        description: `Manifest ${manifestId} created (${consignments.length} parcels assigned).`,
        variant: "success",
      });
    }, 400);
  };

  return (
    <div className="dispatch-modal-backdrop" data-testid="courier-dispatch-console">
      <div className="dispatch-modal-card">
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <div className="header-pill">Logistics Fulfillment Hub</div>
            <h2 className="modal-title">Bulk Courier Dispatch Manifest</h2>
            <p className="modal-sub">
              Book consignments via Pathao / Steadfast API, generate tracking numbers, and print thermal labels.
            </p>
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Close modal">
            ✕
          </button>
        </div>

        {!generatedManifest ? (
          <>
            {/* Courier Configuration */}
            <div className="config-grid">
              <div className="form-group">
                <label className="input-label">Courier Logistics Partner</label>
                <div className="courier-toggle-group">
                  <button
                    type="button"
                    className={`courier-btn ${courier === "Pathao" ? "active" : ""}`}
                    onClick={() => setCourier("Pathao")}
                    data-testid="courier-select-pathao"
                  >
                    <span>🏍️ Pathao Courier (Express API)</span>
                  </button>
                  <button
                    type="button"
                    className={`courier-btn ${courier === "Steadfast" ? "active" : ""}`}
                    onClick={() => setCourier("Steadfast")}
                    data-testid="courier-select-steadfast"
                  >
                    <span>🚚 Steadfast Logistics (National)</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">Pickup Godown Hub</label>
                <input
                  type="text"
                  readOnly
                  value="Nawabpur Central Godown (Hub ID: HUB-NCA-01)"
                  className="godown-input"
                />
              </div>
            </div>

            {/* Packed Orders Queue */}
            <div className="orders-section">
              <div className="orders-header">
                <span className="section-title">Packed Parcels Ready for Handover</span>
                <span className="count-tag">{selectedIds.length} of {packedOrders.length} selected</span>
              </div>

              {packedOrders.length === 0 ? (
                <div className="empty-queue-msg">
                  No orders currently in PACKED status. Advance orders from Godown QC first.
                </div>
              ) : (
                <div className="orders-list">
                  {packedOrders.map((order) => (
                    <label key={order.id} className="order-check-item">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => handleToggleOrder(order.id)}
                        className="order-checkbox"
                      />
                      <div className="order-detail-col">
                        <div className="order-num-row">
                          <span className="num">{order.orderNumber}</span>
                          <span className="dest">📍 {order.division} ({order.district})</span>
                          <span className={`pay-pill ${order.paymentStatus === "PAID" ? "pay-paid" : "pay-cod"}`}>
                            {order.paymentStatus === "PAID" ? "PAID" : `COD ${formatPaisa(order.totalPaisa)}`}
                          </span>
                        </div>
                        <div className="customer-info">
                          {order.customerName} · {order.items.map((i) => `${i.quantity}x ${i.skuTitle}`).join(", ")}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-cancel">
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit"
                disabled={isBooking || selectedIds.length === 0}
                onClick={handleGenerateConsignments}
                data-testid="btn-generate-manifest"
              >
                {isBooking ? "Booking Consignments..." : `🚀 Book & Dispatch ${selectedIds.length} Parcels`}
              </button>
            </div>
          </>
        ) : (
          /* Manifest Success & Thermal Label Print View */
          <div className="manifest-success-view">
            <div className="success-banner">
              <span className="success-icon">✅</span>
              <div>
                <h3 className="success-title">Dispatch Manifest Booked Successfully</h3>
                <span className="manifest-code">Manifest ID: {generatedManifest.manifestId}</span>
              </div>
            </div>

            <div className="consignments-table-wrap">
              <table className="consignments-table">
                <thead>
                  <tr>
                    <th>Order Number</th>
                    <th>Consignment / Tracking ID</th>
                    <th>Customer Name</th>
                    <th>COD Collection</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedManifest.consignments.map((c) => (
                    <tr key={c.orderNumber}>
                      <td className="font-mono">{c.orderNumber}</td>
                      <td className="font-mono tracking-num">{c.consignmentId}</td>
                      <td>{c.customer}</td>
                      <td>{c.codPaisa > 0 ? formatPaisa(c.codPaisa) : "0 (PAID)"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="manifest-actions">
              <button
                type="button"
                className="btn-print-labels"
                onClick={() => window.print()}
                data-testid="btn-print-shipping-labels"
              >
                🖨️ Print 4x6" Thermal Shipping Labels
              </button>
              <button type="button" onClick={onClose} className="btn-done">
                Done &amp; Return to Kanban
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .dispatch-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .dispatch-modal-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          max-width: 640px;
          width: 100%;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          color: #f8fafc;
          max-height: 90vh;
          overflow-y: auto;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header-pill {
          font-size: 10px;
          font-weight: 800;
          color: #10b981;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 900;
          margin: 4px 0 2px 0;
        }

        .modal-sub {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }

        /* Config */
        .config-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 14px;
        }

        .input-label {
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
          margin-bottom: 6px;
          display: block;
        }

        .courier-toggle-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .courier-btn {
          padding: 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          cursor: pointer;
          text-align: center;
        }

        .courier-btn.active {
          background: rgba(16, 185, 129, 0.2);
          border-color: #10b981;
          color: #10b981;
        }

        .godown-input {
          width: 100%;
          background: #0b1329;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 8px 10px;
          color: #94a3b8;
          font-size: 11px;
          font-family: monospace;
          outline: none;
        }

        /* Orders */
        .orders-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .orders-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .section-title {
          font-size: 12px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .count-tag {
          font-size: 11px;
          color: #94a3b8;
        }

        .orders-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 180px;
          overflow-y: auto;
        }

        .order-check-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 10px;
          cursor: pointer;
        }

        .order-checkbox {
          margin-top: 3px;
        }

        .order-detail-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .order-num-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .order-num-row .num {
          font-size: 12px;
          font-weight: 800;
          color: #f8fafc;
          font-family: monospace;
        }

        .order-num-row .dest {
          font-size: 11px;
          color: #38bdf8;
        }

        .pay-pill {
          font-size: 9px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 4px;
        }

        .pay-paid {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .pay-cod {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .customer-info {
          font-size: 11px;
          color: #94a3b8;
        }

        .empty-queue-msg {
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }

        /* Actions */
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 8px;
        }

        .btn-cancel {
          padding: 10px 16px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: none;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-submit {
          padding: 10px 20px;
          border-radius: 8px;
          background: #10b981;
          color: #022c22;
          font-size: 12px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          transition: transform 0.12s ease;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Success View */
        .manifest-success-view {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .success-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 10px;
          padding: 14px;
        }

        .success-icon {
          font-size: 28px;
        }

        .success-title {
          font-size: 14px;
          font-weight: 800;
          margin: 0;
          color: #10b981;
        }

        .manifest-code {
          font-size: 11px;
          font-family: monospace;
          color: #a7f3d0;
        }

        .consignments-table-wrap {
          background: #1e293b;
          border-radius: 8px;
          overflow: hidden;
        }

        .consignments-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          text-align: left;
        }

        .consignments-table th {
          background: #0b1329;
          color: #94a3b8;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .consignments-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .tracking-num {
          color: #38bdf8;
          font-weight: 800;
        }

        .manifest-actions {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .btn-print-labels {
          padding: 10px 16px;
          border-radius: 8px;
          background: #3b82f6;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          border: none;
          cursor: pointer;
        }

        .btn-done {
          padding: 10px 16px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 700;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
