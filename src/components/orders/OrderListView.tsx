"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatPaisaToBDT, type CustomerOrder, type OrderStatus } from "./types";

interface OrderListViewProps {
  initialOrders: CustomerOrder[];
}

type FilterTab = "ALL" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";

export function OrderListView({ initialOrders }: OrderListViewProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

  const filteredOrders = initialOrders.filter((order) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "PROCESSING") {
      return (
        order.status === "CONFIRMED" ||
        order.status === "SOURCING" ||
        order.status === "QC_PASSED" ||
        order.status === "PACKED"
      );
    }
    if (activeTab === "DISPATCHED") {
      return order.status === "WITH_COURIER" || order.status === "OUT_FOR_DELIVERY";
    }
    if (activeTab === "DELIVERED") {
      return order.status === "DELIVERED";
    }
    if (activeTab === "CANCELLED") {
      return order.status === "CANCELLED" || order.status === "RETURNED_RTO";
    }
    return true;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "CONFIRMED":
      case "SOURCING":
        return <span className="status-badge status-sourcing">⚡ Sourcing in Nawabpur</span>;
      case "QC_PASSED":
        return <span className="status-badge status-qc">✓ QC Tested &amp; Sealed</span>;
      case "PACKED":
        return <span className="status-badge status-packed">📦 Packed for Courier</span>;
      case "WITH_COURIER":
        return <span className="status-badge status-courier">🚚 In Transit with Courier</span>;
      case "OUT_FOR_DELIVERY":
        return <span className="status-badge status-delivery">🛵 Out for Delivery</span>;
      case "DELIVERED":
        return <span className="status-badge status-delivered">🎉 Delivered</span>;
      case "CANCELLED":
        return <span className="status-badge status-cancelled">✕ Cancelled</span>;
      case "RETURNED_RTO":
        return <span className="status-badge status-rto">↩️ Returned to Godown</span>;
      default:
        return <span className="status-badge status-default">{status}</span>;
    }
  };

  return (
    <div className="orders-list-view" role="region" aria-label="Customer Orders History">
      <header className="orders-header">
        <div>
          <h1>My Orders &amp; Deliveries</h1>
          <p>Real-time delivery progress, live courier tracking, and official Mushak 6.3 invoices.</p>
        </div>

        {/* Status Filter Tabs */}
        <div className="filter-tabs" role="tablist" aria-label="Order Status Filters">
          {(
            [
              { id: "ALL", label: "All Orders" },
              { id: "PROCESSING", label: "In Progress" },
              { id: "DISPATCHED", label: "With Courier" },
              { id: "DELIVERED", label: "Delivered" },
              { id: "CANCELLED", label: "Cancelled" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`filter-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="zero-orders-card">
          <span className="zero-icon">📦</span>
          <h3>No Orders Found</h3>
          <p>You have no orders matching the selected filter criteria.</p>
          <Link href="/products" className="btn btn-primary">
            Explore Nawabpur Catalog
          </Link>
        </div>
      ) : (
        <div className="orders-cards-stack">
          {filteredOrders.map((order) => {
            const formattedDate = new Date(order.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <article key={order.orderNumber} className="order-summary-card" data-testid="order-card">
                {/* Order Top Bar */}
                <div className="card-top-bar">
                  <div className="order-identity">
                    <span className="order-label">ORDER NUMBER</span>
                    <h3 className="order-num" data-testid="order-number">{order.orderNumber}</h3>
                    <span className="order-date">{formattedDate}</span>
                  </div>

                  <div className="order-top-right">
                    {getStatusBadge(order.status)}
                    <span className={`payment-pill ${order.paymentStatus === "PAID" ? "paid" : "pending"}`}>
                      {order.paymentStatus === "PAID" ? "✓ Paid" : "⏳ COD Pending"}
                    </span>
                  </div>
                </div>

                {/* Items Preview List */}
                <div className="order-items-preview">
                  {order.items.map((item) => (
                    <div key={item.id} className="item-row">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.titleEn} className="item-thumb" />
                      ) : (
                        <div className="item-thumb placeholder">📦</div>
                      )}

                      <div className="item-info">
                        <span className="item-title">{item.titleEn}</span>
                        <div className="item-meta">
                          <span className="item-brand">{item.brandName}</span>
                          <span className="dot">•</span>
                          <span className="item-qty">Qty: {item.quantity}</span>
                          <span className="dot">•</span>
                          <span className={`item-tier ${item.tier.toLowerCase()}`}>
                            {item.tier === "AUTHENTIC" ? "✨ Authentic" : "⚡ Budget Smart"}
                          </span>
                        </div>
                      </div>

                      <span className="item-price">
                        {formatPaisaToBDT(item.totalPaisa)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Card Footer Bar */}
                <footer className="card-footer">
                  <div className="total-display">
                    <span className="total-label">Total Amount:</span>
                    <strong className="total-amount" data-testid="order-total-amount">
                      {formatPaisaToBDT(order.totalPaisa)}
                    </strong>
                  </div>

                  <div className="footer-actions">
                    <a
                      href={order.invoicePdfUrl || `/api/v1/orders/${order.orderNumber}/invoice`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                    >
                      📄 Mushak 6.3 PDF
                    </a>
                    <Link
                      href={`/account/orders/${order.orderNumber}`}
                      className="btn btn-primary"
                      data-testid="track-order-button"
                    >
                      Track Order in Real-Time →
                    </Link>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .orders-list-view {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .orders-header {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        .orders-header h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 0.25rem;
        }

        .orders-header p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .filter-tabs {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
        }

        .filter-tab {
          padding: 0.5rem 1rem;
          border-radius: var(--radius-full, 9999px);
          font-size: 0.8125rem;
          font-weight: 600;
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          color: var(--color-text-secondary);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .filter-tab:hover {
          color: var(--color-text-primary);
          border-color: var(--color-text-primary);
        }

        .filter-tab.active {
          background: #059669;
          color: #ffffff;
          border-color: #059669;
        }

        .orders-cards-stack {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .order-summary-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          transition: border-color 0.15s ease;
        }

        .order-summary-card:hover {
          border-color: #059669;
        }

        .card-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          background: var(--color-surface-subtle, #f8fafc);
          border-bottom: 1px solid var(--color-border, #e5e7eb);
          gap: 1rem;
          flex-wrap: wrap;
        }

        .order-label {
          font-size: 0.625rem;
          letter-spacing: 0.06em;
          font-weight: 700;
          color: var(--color-text-secondary);
          display: block;
        }

        .order-num {
          font-family: var(--font-mono, monospace);
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0.1rem 0;
        }

        .order-date {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .order-top-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .status-badge {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
        }

        .status-sourcing { background: #eff6ff; color: #1d4ed8; }
        .status-qc { background: #ecfdf5; color: #047857; }
        .status-packed { background: #fefce8; color: #a16207; }
        .status-courier { background: #faf5ff; color: #7e22ce; }
        .status-delivery { background: #fff7ed; color: #c2410c; }
        .status-delivered { background: #dcfce7; color: #15803d; }
        .status-cancelled { background: #fee2e2; color: #b91c1c; }
        .status-rto { background: #fef2f2; color: #991b1b; }

        .payment-pill {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
        }

        .payment-pill.paid {
          background: #dcfce7;
          color: #15803d;
        }

        .payment-pill.pending {
          background: #fef3c7;
          color: #b45309;
        }

        /* Items Preview */
        .order-items-preview {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .item-row {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .item-thumb {
          width: 50px;
          height: 50px;
          border-radius: var(--radius-md, 0.5rem);
          object-fit: contain;
          border: 1px solid var(--color-border, #e5e7eb);
          background: #ffffff;
          flex-shrink: 0;
        }

        .item-thumb.placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          background: var(--color-surface-subtle, #f8fafc);
        }

        .item-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .item-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .item-meta {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-wrap: wrap;
        }

        .item-tier.authentic { color: #d97706; font-weight: 600; }
        .item-tier.budget_smart { color: #0284c7; font-weight: 600; }

        .item-price {
          font-family: var(--font-mono, monospace);
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        /* Footer */
        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          background: var(--color-surface-subtle, #f8fafc);
          border-top: 1px solid var(--color-border, #e5e7eb);
          gap: 1rem;
          flex-wrap: wrap;
        }

        .total-display {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }

        .total-label {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .total-amount {
          font-family: var(--font-mono, monospace);
          font-size: 1.25rem;
          font-weight: 800;
          color: #059669;
        }

        .footer-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.8125rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .btn-primary {
          background: #059669;
          color: #ffffff;
          border: none;
        }

        .btn-primary:hover {
          background: #047857;
        }

        .btn-outline {
          background: transparent;
          color: var(--color-text-primary);
          border: 1px solid var(--color-border, #cbd5e1);
        }

        .btn-outline:hover {
          background: #ffffff;
        }

        .zero-orders-card {
          padding: 4rem 2rem;
          text-align: center;
          background: var(--color-surface, #ffffff);
          border: 1px dashed var(--color-border, #cbd5e1);
          border-radius: var(--radius-xl, 1.25rem);
          color: var(--color-text-secondary);
        }

        .zero-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
