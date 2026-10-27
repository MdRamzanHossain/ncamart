"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  formatPaisaToBDT,
  type CustomerOrder,
  type DeliveryMilestone,
} from "./types";
import { useToast } from "@/components/ui/toast";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

interface OrderTrackerViewProps {
  initialOrder: CustomerOrder;
}

export function OrderTrackerView({ initialOrder }: OrderTrackerViewProps) {
  const [order, setOrder] = useState<CustomerOrder>(initialOrder);
  const [isStockoutModalOpen, setIsStockoutModalOpen] = useState(
    Boolean(initialOrder.partialStockout)
  );
  const [isPickupPinModalOpen, setIsPickupPinModalOpen] = useState(false);
  const [selectedStockoutChoice, setSelectedStockoutChoice] = useState<
    "SPLIT_SHIP" | "WAIT_24H" | "CANCEL_ITEM_REFUND"
  >("SPLIT_SHIP");
  const [isSubmittingChoice, setIsSubmittingChoice] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [isCopiedConsignment, setIsCopiedConsignment] = useState(false);

  const { addToast } = useToast();

  // Listen to live SSE status updates
  useRealtimeEvents({
    channel: "customer-orders",
    onMessage: (event) => {
      if (
        event?.payload?.orderNumber === order.orderNumber &&
        event?.payload?.status
      ) {
        setOrder((prev) => ({
          ...prev,
          status: event.payload.status,
        }));
        addToast({
          title: "Order Status Updated",
          description: `Order ${order.orderNumber} is now ${event.payload.status}.`,
          variant: "info",
        });
      }
    },
  });

  const isInTransit =
    order.status === "WITH_COURIER" ||
    order.status === "OUT_FOR_DELIVERY" ||
    order.status === "DELIVERED";

  const handleCopyConsignment = async () => {
    if (order.courier?.consignmentId && typeof window !== "undefined") {
      try {
        await navigator.clipboard.writeText(order.courier.consignmentId);
        setIsCopiedConsignment(true);
        setTimeout(() => setIsCopiedConsignment(false), 2000);
      } catch {
        // Fallback
      }
    }
  };

  const handleStockoutChoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingChoice(true);

    setTimeout(() => {
      // Optimistic update
      setOrder((prev) => ({
        ...prev,
        partialStockout: undefined,
      }));
      setIsSubmittingChoice(false);
      setIsStockoutModalOpen(false);

      const choiceLabels = {
        SPLIT_SHIP: "Available items are being packed for immediate dispatch.",
        WAIT_24H: "Wholesale runner will search secondary godown stalls for 24h.",
        CANCEL_ITEM_REFUND: "Out-of-stock item cancelled and refunded to Store Credit.",
      };

      addToast({
        title: "Preference Confirmed",
        description: choiceLabels[selectedStockoutChoice],
        variant: "success",
      });
    }, 500);
  };

  const handleCancelOrder = () => {
    if (isInTransit) return;

    if (
      !confirm(
        "Are you sure you want to cancel this order? An instant refund will be credited to your Store Credit Wallet."
      )
    ) {
      return;
    }

    setIsCancellingOrder(true);
    setTimeout(() => {
      setOrder((prev) => ({
        ...prev,
        status: "CANCELLED",
      }));
      setIsCancellingOrder(false);
      addToast({
        title: "Order Cancelled",
        description: "Order cancelled successfully. 100% funds credited to your Store Credit Wallet.",
        variant: "info",
      });
    }, 400);
  };

  return (
    <div className="order-tracker-view" role="region" aria-label="Live Delivery Tracker">
      {/* Navigation Breadcrumb */}
      <nav className="tracker-nav" aria-label="Breadcrumb">
        <Link href="/account" className="nav-link">Account</Link>
        <span className="separator">/</span>
        <Link href="/account/orders" className="nav-link">My Orders</Link>
        <span className="separator">/</span>
        <span className="current-id">{order.orderNumber}</span>
      </nav>

      {/* Partial Stockout Alert Banner (PRD §3.11, Edge Case EC-04) */}
      {order.partialStockout && (
        <aside
          className="stockout-alert-banner"
          role="alert"
          aria-label="Partial Stockout Notice"
          data-testid="partial-stockout-banner"
        >
          <div className="alert-content">
            <span className="alert-icon">⚠️</span>
            <div>
              <h3 className="alert-title">Wholesale Stall Stockout Alert</h3>
              <p className="alert-desc">
                Runner note: <em>&ldquo;{order.partialStockout.stallNote}&rdquo;</em> affecting{" "}
                <strong>{order.partialStockout.affectedItemTitle}</strong>. Please choose how you want our dispatch team to proceed.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-warning-action"
            onClick={() => setIsStockoutModalOpen(true)}
            data-testid="resolve-stockout-button"
          >
            Resolve Sourcing Choice →
          </button>
        </aside>
      )}

      {/* Main Order Header Card */}
      <section className="tracker-header-card">
        <div className="header-top">
          <div>
            <span className="eyebrow">ORDER SHIPMENT STATUS</span>
            <h1 className="order-title">
              Order {order.orderNumber}
            </h1>
            <p className="order-date-text">
              Placed on {new Date(order.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="header-actions">
            {order.pickupPin && (
              <button
                type="button"
                className="btn btn-pin"
                onClick={() => setIsPickupPinModalOpen(true)}
                data-testid="view-pickup-pin-button"
              >
                🎟️ View Showroom Pickup PIN
              </button>
            )}

            {/* In-Transit Cancellation Lock (PRD §3.12, Edge Case EC-03) */}
            <div className="cancel-lock-container">
              <button
                type="button"
                className={`btn ${isInTransit ? "btn-disabled" : "btn-danger-outline"}`}
                onClick={handleCancelOrder}
                disabled={isInTransit || order.status === "CANCELLED" || isCancellingOrder}
                data-testid="cancel-order-button"
              >
                {isInTransit ? "🔒 Cancellation Locked" : "✕ Cancel Order"}
              </button>

              {isInTransit && (
                <div className="lock-tooltip" data-testid="cancellation-lock-tooltip">
                  Parcel has already been dispatched with courier rider. Refuse parcel at doorstep or initiate RMA upon arrival.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6-STAGE INTERACTIVE PROGRESS RAIL */}
        <div className="progress-rail-container" data-testid="progress-rail">
          <div className="rail-track">
            <div
              className="rail-progress-fill"
              style={{
                width: `${Math.min(
                  100,
                  (order.milestones.filter((m) => m.isCompleted).length /
                    (order.milestones.length - 1)) *
                    100
                )}%`,
              }}
            ></div>
          </div>

          <div className="milestones-row">
            {order.milestones.map((milestone) => (
              <div
                key={milestone.stage}
                className={`milestone-node ${
                  milestone.isCompleted ? "completed" : ""
                } ${milestone.isCurrent ? "current" : ""}`}
                data-testid="milestone-node"
              >
                <div className="node-circle">
                  {milestone.isCompleted ? "✓" : milestone.stage}
                </div>
                <div className="node-info">
                  <span className="node-label">{milestone.label}</span>
                  <span className="node-sublabel">{milestone.sublabel}</span>
                  {milestone.timestamp && (
                    <span className="node-time">
                      {new Date(milestone.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Grid: Courier Details & Shipping Address */}
      <div className="tracker-details-grid">
        {/* Courier Details Card */}
        {order.courier ? (
          <article className="grid-card courier-card" data-testid="courier-details-card">
            <div className="card-header">
              <span className="header-icon">🚚</span>
              <h2>Courier Partner &amp; Consignment</h2>
            </div>

            <div className="courier-body">
              <div className="courier-badge-row">
                <span className="courier-brand-pill">
                  {order.courier.partner} EXPRESS
                </span>
                <span className="live-pill">⚡ Live Dispatch API</span>
              </div>

              <div className="consignment-box">
                <div className="consignment-info">
                  <span className="consignment-label">CONSIGNMENT TRACKING NUMBER</span>
                  <span className="consignment-code" data-testid="consignment-id">
                    {order.courier.consignmentId}
                  </span>
                </div>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={handleCopyConsignment}
                >
                  {isCopiedConsignment ? "✓ Copied" : "📋 Copy"}
                </button>
              </div>

              <div className="courier-hotline-row">
                <span>Courier Hotline:</span>
                <a href={`tel:${order.courier.hotline}`} className="hotline-link">
                  📞 {order.courier.hotline}
                </a>
              </div>

              {order.courier.riderName && (
                <div className="rider-row">
                  <span>Assigned Rider:</span>
                  <strong>{order.courier.riderName} ({order.courier.riderPhone})</strong>
                </div>
              )}
            </div>
          </article>
        ) : (
          <article className="grid-card pickup-card">
            <div className="card-header">
              <span className="header-icon">🏢</span>
              <h2>Nawabpur Showroom Collection</h2>
            </div>
            <div className="pickup-body">
              <p>
                This parcel is held at our physical counter:
                <strong> Shop 42, Nawabpur Complex, Sundarban Square Market</strong>.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsPickupPinModalOpen(true)}
              >
                View 6-Digit Pickup PIN
              </button>
            </div>
          </article>
        )}

        {/* Shipping Address & Recipient */}
        <article className="grid-card address-card">
          <div className="card-header">
            <span className="header-icon">📍</span>
            <h2>Delivery Destination</h2>
          </div>

          <div className="address-body">
            <h3 className="recipient-name">
              {order.shippingAddress.consigneeName}
            </h3>
            <span className="recipient-phone">
              {order.shippingAddress.contactPhone}
            </span>
            <p className="recipient-street">
              {order.shippingAddress.streetAddress}
            </p>
            <p className="recipient-geo">
              {order.shippingAddress.thana}, {order.shippingAddress.district}
            </p>
          </div>
        </article>
      </div>

      {/* Itemized Order Manifest */}
      <section className="order-manifest-card">
        <div className="card-header">
          <span className="header-icon">📦</span>
          <h2>Itemized Order Manifest</h2>
        </div>

        <div className="manifest-items">
          {order.items.map((item) => (
            <div key={item.id} className="manifest-row">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.titleEn} className="item-thumb" />
              ) : (
                <div className="item-thumb placeholder">📦</div>
              )}

              <div className="item-info">
                <span className="item-title">{item.titleEn}</span>
                <span className="item-subtitle">{item.titleBn}</span>
                <div className="item-specs">
                  <span>SKU: {item.sku}</span>
                  <span className="dot">•</span>
                  <span>Qty: {item.quantity}</span>
                  <span className="dot">•</span>
                  <span className={`tier-badge ${item.tier.toLowerCase()}`}>
                    {item.tier === "AUTHENTIC" ? "✨ Authentic" : "⚡ Budget Smart"}
                  </span>
                </div>
              </div>

              <div className="item-pricing">
                <span className="unit-price">
                  {formatPaisaToBDT(item.unitPricePaisa)} each
                </span>
                <strong className="item-total">
                  {formatPaisaToBDT(item.totalPaisa)}
                </strong>
              </div>
            </div>
          ))}
        </div>

        <div className="manifest-summary">
          <div className="summary-row">
            <span>Payment Method:</span>
            <strong>{order.paymentMethod.replace(/_/g, " ")}</strong>
          </div>
          <div className="summary-row">
            <span>Payment Status:</span>
            <span className={`payment-pill ${order.paymentStatus === "PAID" ? "paid" : "pending"}`}>
              {order.paymentStatus === "PAID" ? "✓ Paid" : "⏳ COD Pending"}
            </span>
          </div>
          <div className="summary-row grand-total">
            <span>Grand Total (VAT Incl.):</span>
            <strong className="grand-total-amount">
              {formatPaisaToBDT(order.totalPaisa)}
            </strong>
          </div>
        </div>
      </section>

      {/* PARTIAL STOCKOUT CUSTOMER DECISION MODAL (PRD §3.11, Edge Case EC-04) */}
      {isStockoutModalOpen && order.partialStockout && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="stockout-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="stockout-modal-title">Wholesale Sourcing Decision Needed</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsStockoutModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStockoutChoiceSubmit} className="stockout-form">
              <div className="stockout-explanation">
                <p>
                  While sourcing at Nawabpur market, our runner encountered a wholesale stall stockout on:
                </p>
                <div className="affected-item-box">
                  <strong>{order.partialStockout.affectedItemTitle}</strong>
                  <span>{order.partialStockout.stallNote}</span>
                </div>
                <p>Please select your preferred resolution to proceed with dispatch:</p>
              </div>

              <div className="choices-list">
                <label className={`choice-card ${selectedStockoutChoice === "SPLIT_SHIP" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="stockout-choice"
                    value="SPLIT_SHIP"
                    checked={selectedStockoutChoice === "SPLIT_SHIP"}
                    onChange={() => setSelectedStockoutChoice("SPLIT_SHIP")}
                  />
                  <div className="choice-text">
                    <strong>Option A: Split &amp; Ship Available Items Immediately</strong>
                    <span>We pack in-stock items now. The remaining item will ship free when restocked.</span>
                  </div>
                </label>

                <label className={`choice-card ${selectedStockoutChoice === "WAIT_24H" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="stockout-choice"
                    value="WAIT_24H"
                    checked={selectedStockoutChoice === "WAIT_24H"}
                    onChange={() => setSelectedStockoutChoice("WAIT_24H")}
                  />
                  <div className="choice-text">
                    <strong>Option B: Wait 24 Hours for Alternate Wholesale Sourcing</strong>
                    <span>Hold dispatch for 24 hours while our runner inspects secondary dealer stalls.</span>
                  </div>
                </label>

                <label className={`choice-card ${selectedStockoutChoice === "CANCEL_ITEM_REFUND" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="stockout-choice"
                    value="CANCEL_ITEM_REFUND"
                    checked={selectedStockoutChoice === "CANCEL_ITEM_REFUND"}
                    onChange={() => setSelectedStockoutChoice("CANCEL_ITEM_REFUND")}
                  />
                  <div className="choice-text">
                    <strong>Option C: Cancel Out-of-Stock Item &amp; Receive Store Credit</strong>
                    <span>Cancel the affected item only. Receive 100% instant refund into your Store Credit Wallet.</span>
                  </div>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingChoice}
                >
                  {isSubmittingChoice ? "Confirming Preference..." : "Confirm Sourcing Choice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHOWROOM PICKUP PIN MODAL */}
      {isPickupPinModalOpen && order.pickupPin && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="pin-modal-title">Nawabpur Showroom Pickup Pass</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsPickupPinModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="pin-body">
              <span className="pin-eyebrow">COUNTER VERIFICATION PIN</span>
              <div className="pin-code-box" data-testid="pickup-pin-code">
                {order.pickupPin.pin}
              </div>
              <p className="pin-note">
                Present this 6-digit PIN or show this screen to the counter staff at:
                <br />
                <strong>{order.pickupPin.showroomLocation}</strong>
              </p>

              <div className="pin-qr-wrap">
                <div className="simulated-qr">
                  <span>[COUNTER SCANNER QR]</span>
                </div>
              </div>

              <div className="pin-expiry-badge">
                ⏳ Valid until:{" "}
                {new Date(order.pickupPin.expiresAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .order-tracker-view {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .tracker-nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .tracker-nav :global(a) {
          color: var(--color-text-secondary);
          text-decoration: none;
        }

        .tracker-nav :global(a:hover) {
          color: #059669;
        }

        .separator { opacity: 0.4; }
        .current-id { font-family: var(--font-mono, monospace); font-weight: 700; color: var(--color-text-primary); }

        /* Stockout Alert Banner */
        .stockout-alert-banner {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-left: 5px solid #d97706;
          border-radius: var(--radius-lg, 0.75rem);
          padding: 1.25rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
        }

        @media (max-width: 768px) {
          .stockout-alert-banner {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        .alert-content {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .alert-icon { font-size: 1.5rem; flex-shrink: 0; }
        .alert-title { font-size: 1rem; font-weight: 700; color: #92400e; margin-bottom: 0.2rem; }
        .alert-desc { font-size: 0.875rem; color: #78350f; line-height: 1.4; }

        .btn-warning-action {
          background: #d97706;
          color: #ffffff;
          border: none;
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn-warning-action:hover { background: #b45309; }

        /* Header Card */
        .tracker-header-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 2rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        @media (max-width: 768px) {
          .tracker-header-card { padding: 1.5rem; }
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
          margin-bottom: 2.5rem;
        }

        @media (max-width: 768px) {
          .header-top { flex-direction: column; }
        }

        .eyebrow {
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          font-weight: 800;
          color: #059669;
        }

        .order-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0.2rem 0;
        }

        .order-date-text {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .btn-pin {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
        }

        /* Cancellation lock */
        .cancel-lock-container {
          position: relative;
          display: inline-block;
        }

        .cancel-lock-container:hover .lock-tooltip {
          visibility: visible;
          opacity: 1;
        }

        .btn-disabled {
          background: var(--color-surface-subtle, #f8fafc);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border, #cbd5e1);
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: not-allowed;
          opacity: 0.8;
        }

        .btn-danger-outline {
          background: transparent;
          color: #dc2626;
          border: 1px solid #fca5a5;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
        }

        .lock-tooltip {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          width: 260px;
          background: #111827;
          color: #ffffff;
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.6875rem;
          line-height: 1.4;
          z-index: 20;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
          transition: opacity 0.2s ease;
          pointer-events: none;
        }

        /* ---------------------------------------------------- */
        /* PROGRESS RAIL */
        /* ---------------------------------------------------- */
        .progress-rail-container {
          position: relative;
          padding: 0 1rem;
        }

        .rail-track {
          position: absolute;
          top: 18px;
          left: 5%;
          right: 5%;
          height: 4px;
          background: var(--color-border, #e2e8f0);
          z-index: 1;
        }

        .rail-progress-fill {
          height: 100%;
          background: #10b981;
          transition: width 0.3s ease;
        }

        .milestones-row {
          position: relative;
          display: flex;
          justify-content: space-between;
          z-index: 2;
        }

        .milestone-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 120px;
        }

        .node-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid var(--color-border, #cbd5e1);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8125rem;
          font-weight: 800;
          margin-bottom: 0.75rem;
          transition: all 0.2s ease;
        }

        .milestone-node.completed .node-circle {
          background: #10b981;
          border-color: #10b981;
          color: #ffffff;
        }

        .milestone-node.current .node-circle {
          background: #059669;
          border-color: #34d399;
          color: #ffffff;
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.7);
          animation: pulseNode 2s infinite ease-in-out;
        }

        @keyframes pulseNode {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }

        .node-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .node-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .node-sublabel {
          font-size: 0.625rem;
          color: var(--color-text-secondary);
        }

        .node-time {
          font-size: 0.625rem;
          font-family: var(--font-mono, monospace);
          color: #059669;
          font-weight: 700;
        }

        /* ---------------------------------------------------- */
        /* DETAILS GRID */
        /* ---------------------------------------------------- */
        .tracker-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 860px) {
          .tracker-details-grid {
            grid-template-columns: 1fr;
          }
        }

        .grid-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 1.5rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
          margin-bottom: 1.25rem;
        }

        .card-header h2 {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .header-icon { font-size: 1.25rem; }

        .courier-badge-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .courier-brand-pill {
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.625rem;
          border-radius: 9999px;
        }

        .live-pill {
          background: #ecfdf5;
          color: #047857;
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
        }

        .consignment-box {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
        }

        .consignment-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .consignment-label {
          font-size: 0.625rem;
          letter-spacing: 0.06em;
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .consignment-code {
          font-family: var(--font-mono, monospace);
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .copy-btn {
          background: transparent;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-sm, 0.375rem);
          padding: 0.35rem 0.625rem;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
        }

        .courier-hotline-row, .rider-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          margin-bottom: 0.5rem;
        }

        .hotline-link {
          color: #059669;
          font-weight: 700;
          text-decoration: none;
        }

        .recipient-name {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.2rem;
        }

        .recipient-phone {
          font-family: var(--font-mono, monospace);
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          display: block;
          margin-bottom: 0.75rem;
        }

        .recipient-street {
          font-size: 0.875rem;
          color: var(--color-text-primary);
          line-height: 1.4;
          margin-bottom: 0.25rem;
        }

        .recipient-geo {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        /* Itemized Manifest */
        .order-manifest-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 2rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        .manifest-items {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        .manifest-row {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .item-thumb {
          width: 60px;
          height: 60px;
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
          font-size: 1.5rem;
          background: var(--color-surface-subtle, #f8fafc);
        }

        .item-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .item-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .item-subtitle {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .item-specs {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .tier-badge.authentic { color: #d97706; font-weight: 700; }
        .tier-badge.budget_smart { color: #0284c7; font-weight: 700; }

        .item-pricing {
          text-align: right;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .unit-price { font-size: 0.75rem; color: var(--color-text-secondary); font-family: var(--font-mono, monospace); }
        .item-total { font-size: 1rem; font-weight: 700; color: var(--color-text-primary); font-family: var(--font-mono, monospace); }

        .manifest-summary {
          padding-top: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-width: 380px;
          margin-left: auto;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .summary-row.grand-total {
          padding-top: 0.75rem;
          border-top: 1px dashed var(--color-border, #e5e7eb);
          font-size: 1.125rem;
          color: var(--color-text-primary);
        }

        .grand-total-amount {
          color: #059669;
          font-family: var(--font-mono, monospace);
          font-size: 1.25rem;
        }

        .payment-pill {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
        }
        .payment-pill.paid { background: #dcfce7; color: #15803d; }
        .payment-pill.pending { background: #fef3c7; color: #b45309; }

        /* ---------------------------------------------------- */
        /* MODALS */
        /* ---------------------------------------------------- */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1.5rem;
        }

        .modal-content {
          background: var(--color-surface, #ffffff);
          border-radius: var(--radius-xl, 1.25rem);
          max-width: 520px;
          width: 100%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        .modal-header h3 { font-size: 1.125rem; font-weight: 700; }
        .close-btn { background: transparent; border: none; font-size: 1.25rem; cursor: pointer; }

        .stockout-form {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .stockout-explanation p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          line-height: 1.4;
          margin-bottom: 0.5rem;
        }

        .affected-item-box {
          background: #fffbeb;
          border: 1px solid #fde68a;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md, 0.5rem);
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
          font-size: 0.875rem;
        }

        .choices-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .choice-card {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-lg, 0.75rem);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .choice-card.active {
          border-color: #059669;
          background: #f0fdf4;
        }

        .choice-text {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .choice-text strong { font-size: 0.875rem; color: var(--color-text-primary); }
        .choice-text span { font-size: 0.75rem; color: var(--color-text-secondary); line-height: 1.3; }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        /* Showroom Pin Modal */
        .pin-body {
          padding: 2.5rem 1.5rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .pin-eyebrow {
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          font-weight: 800;
          color: #059669;
        }

        .pin-code-box {
          font-family: var(--font-mono, monospace);
          font-size: 3rem;
          font-weight: 800;
          letter-spacing: 0.15em;
          color: #047857;
          background: #dcfce7;
          border: 2px dashed #10b981;
          padding: 0.5rem 1.5rem;
          border-radius: var(--radius-lg, 0.75rem);
        }

        .pin-note { font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.4; max-width: 360px; }

        .simulated-qr {
          width: 140px;
          height: 140px;
          background: #f1f5f9;
          border: 2px solid #cbd5e1;
          border-radius: var(--radius-md, 0.5rem);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
        }

        .pin-expiry-badge {
          font-size: 0.75rem;
          color: #b45309;
          background: #fef3c7;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-weight: 600;
        }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-primary { background: #059669; color: #ffffff; border: none; }
        .btn-primary:hover { background: #047857; }
      `}</style>
    </div>
  );
}
