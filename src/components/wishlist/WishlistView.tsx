"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { WishlistItem } from "./types";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";

interface WishlistViewProps {
  initialItems?: WishlistItem[];
}

const DEFAULT_WISHLIST_ITEMS: WishlistItem[] = [
  {
    id: "wish_01",
    productId: "prod_anker_735",
    skuId: "sku_anker_65w_blk",
    slug: "anker-735-ganprime-65w",
    title: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
    category: "Power Electronics",
    tier: "AUTHENTIC",
    regularPricePaisa: 520000,
    currentPricePaisa: 485000,
    originalPricePaisa: 520000,
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
    availability: "IN_STOCK",
    priceDropAlert: true,
    stockAlert: false,
    lastPriceDropPaisa: 35000,
    addedAt: "2026-10-20",
  },
  {
    id: "wish_02",
    productId: "prod_rigol_ds1054z",
    skuId: "sku_rigol_50mhz",
    slug: "rigol-ds1054z-digital-oscilloscope",
    title: "Rigol DS1054Z 50MHz 4-Channel Digital Oscilloscope",
    category: "Testing & Measurement",
    tier: "AUTHENTIC",
    regularPricePaisa: 4250000,
    currentPricePaisa: 4250000,
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80",
    availability: "LOW_STOCK",
    priceDropAlert: true,
    stockAlert: true,
    addedAt: "2026-10-15",
  },
  {
    id: "wish_03",
    productId: "prod_ts101_soldering",
    skuId: "sku_ts101_grey",
    slug: "miniware-ts101-smart-soldering-iron",
    title: "MINIWARE TS101 65W Smart USB-C Soldering Iron",
    category: "Soldering & Rework",
    tier: "BUDGET_SMART",
    regularPricePaisa: 780000,
    currentPricePaisa: 780000,
    image: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80",
    availability: "PRE_ORDER",
    priceDropAlert: false,
    stockAlert: true,
    addedAt: "2026-10-10",
  },
];

export function WishlistView({ initialItems = DEFAULT_WISHLIST_ITEMS }: WishlistViewProps) {
  const [items, setItems] = useState<WishlistItem[]>(initialItems);
  const [isMovingAll, setIsMovingAll] = useState(false);
  const { addToast } = useToast();

  const handleTogglePriceAlert = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const next = !item.priceDropAlert;
          addToast({
            title: next ? "Price-Drop Alert Activated" : "Price Alert Muted",
            description: next
              ? `We'll alert your WhatsApp/SMS the moment "${item.title}" drops below ${formatPaisa(item.currentPricePaisa)}.`
              : `Price drop notifications muted for "${item.title}".`,
            variant: next ? "success" : "info",
          });
          return { ...item, priceDropAlert: next };
        }
        return item;
      })
    );
  };

  const handleToggleStockAlert = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const next = !item.stockAlert;
          addToast({
            title: next ? "Restock / Pre-Order Alert Set" : "Stock Alert Muted",
            description: next
              ? `You will receive a priority WhatsApp notification when new Nawabpur batches arrive for "${item.title}".`
              : `Restock alerts muted for "${item.title}".`,
            variant: next ? "success" : "info",
          });
          return { ...item, stockAlert: next };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (itemId: string, title: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    addToast({
      title: "Item Removed",
      description: `"${title}" has been removed from your saved items.`,
      variant: "info",
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ncamart:wishlist-updated", {
          detail: { removedId: itemId, totalCount: items.length - 1 },
        })
      );
    }
  };

  const handleMoveToCart = (item: WishlistItem) => {
    if (item.availability === "OUT_OF_STOCK") {
      addToast({
        title: "Currently Out of Stock",
        description: "This item is awaiting Nawabpur stall replenishment. Turn on restock alerts to be notified.",
        variant: "error",
      });
      return;
    }

    // Dispatch global cart addition event
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ncamart:cart-add", {
          detail: {
            productId: item.productId,
            skuId: item.skuId,
            quantity: 1,
            pricePaisa: item.currentPricePaisa,
            title: item.title,
          },
        })
      );
    }

    // Remove from wishlist
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    addToast({
      title: "Moved to Cart!",
      description: `"${item.title}" reserved for 15 minutes.`,
      variant: "success",
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ncamart:wishlist-updated", {
          detail: { removedId: item.id, totalCount: items.length - 1 },
        })
      );
    }
  };

  const handleMoveAllToCart = () => {
    const availableItems = items.filter((i) => i.availability !== "OUT_OF_STOCK");
    if (availableItems.length === 0) {
      addToast({
        title: "No Available Items",
        description: "None of your saved items are currently in stock or pre-orderable.",
        variant: "error",
      });
      return;
    }

    setIsMovingAll(true);

    availableItems.forEach((item) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ncamart:cart-add", {
            detail: {
              productId: item.productId,
              skuId: item.skuId,
              quantity: 1,
              pricePaisa: item.currentPricePaisa,
              title: item.title,
            },
          })
        );
      }
    });

    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.availability === "OUT_OF_STOCK"));
      setIsMovingAll(false);
      addToast({
        title: "All Available Items Moved to Cart",
        description: `${availableItems.length} items reserved for 15 minutes in your cart drawer.`,
        variant: "success",
      });
    }, 400);
  };

  const inStockCount = items.filter((i) => i.availability === "IN_STOCK" || i.availability === "LOW_STOCK").length;
  const activeAlertsCount = items.filter((i) => i.priceDropAlert || i.stockAlert).length;

  return (
    <div className="wishlist-container">
      {/* Top Header & Actions */}
      <div className="wishlist-header">
        <div>
          <div className="header-badge-row">
            <span className="badge-pill">Saved Hardware Hub</span>
            <span className="spec-tag">PRD §3.16 & §3.17 Real-Time Price Tracking</span>
          </div>
          <h1 className="wishlist-title">Customer Wishlist &amp; Price-Drop Alerts</h1>
          <p className="wishlist-subtitle">
            Monitored gear with automated SMS &amp; WhatsApp alerts for price drops and pre-order arrivals.
          </p>
        </div>

        {items.length > 0 && (
          <div className="header-actions">
            <button
              type="button"
              className="move-all-btn"
              onClick={handleMoveAllToCart}
              disabled={isMovingAll || inStockCount === 0}
            >
              <span className="btn-icon">🛒</span>
              <span>{isMovingAll ? "Moving All..." : `Move All to Cart (${inStockCount})`}</span>
            </button>
          </div>
        )}
      </div>

      {/* Metrics Strip */}
      <div className="metrics-strip">
        <div className="metric-box">
          <span className="metric-label">Saved Items</span>
          <span className="metric-value">{items.length}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Ready for Dispatch</span>
          <span className="metric-value in-stock">{inStockCount}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Active Auto-Alerts</span>
          <span className="metric-value alerts">{activeAlertsCount}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">SMS / WhatsApp Quiet Hours</span>
          <span className="metric-value quiet">08:00 – 22:00</span>
        </div>
      </div>

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="empty-wishlist-card">
          <div className="empty-heart-icon">💔</div>
          <h2 className="empty-title">Your Wishlist is Empty</h2>
          <p className="empty-desc">
            Save industrial power supplies, soldering tools, and measurement instruments to track price drops and receive instant arrival alerts.
          </p>
          <Link href="/catalog" className="browse-catalog-cta">
            <span>Browse Authentic Catalog</span>
            <span>→</span>
          </Link>
        </div>
      ) : (
        /* Wishlist Responsive Grid */
        <div className="wishlist-grid">
          {items.map((item) => {
            const hasDropped = item.originalPricePaisa && item.currentPricePaisa < item.originalPricePaisa;
            const savingsPercent = hasDropped
              ? Math.round(((item.originalPricePaisa! - item.currentPricePaisa) / item.originalPricePaisa!) * 100)
              : 0;

            return (
              <div key={item.id} className="wishlist-card" data-testid={`wishlist-card-${item.id}`}>
                {/* Image and Badges */}
                <div className="card-media-wrap">
                  <Link href={`/products/${item.slug}`} className="media-link">
                    <img src={item.image} alt={item.title} className="item-thumbnail" />
                  </Link>

                  <div className="floating-tier-badge">
                    {item.tier === "AUTHENTIC" ? (
                      <span className="tier-tag authentic">✨ Authentic</span>
                    ) : (
                      <span className="tier-tag budget">⚡ Budget Smart</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="delete-item-btn"
                    onClick={() => handleRemoveItem(item.id, item.title)}
                    aria-label={`Remove ${item.title}`}
                    title="Remove from wishlist"
                  >
                    ✕
                  </button>
                </div>

                {/* Content */}
                <div className="card-body">
                  <span className="item-category">{item.category}</span>
                  <Link href={`/products/${item.slug}`} className="item-title-link">
                    <h3 className="item-title">{item.title}</h3>
                  </Link>

                  {/* Stock Status Pill */}
                  <div className="stock-status-row">
                    {item.availability === "IN_STOCK" && (
                      <span className="status-pill in-stock">● In Stock (24h Dispatch)</span>
                    )}
                    {item.availability === "LOW_STOCK" && (
                      <span className="status-pill low-stock">⚠️ Low Stock at Godown</span>
                    )}
                    {item.availability === "PRE_ORDER" && (
                      <span className="status-pill pre-order">⏳ Pre-Order (Direct Import)</span>
                    )}
                    {item.availability === "OUT_OF_STOCK" && (
                      <span className="status-pill out-of-stock">✕ Restocking Soon</span>
                    )}
                  </div>

                  {/* Pricing with Price Drop Indicator */}
                  <div className="pricing-row">
                    <div className="price-stack">
                      <span className="current-price">{formatPaisa(item.currentPricePaisa)}</span>
                      {hasDropped && (
                        <div className="drop-info">
                          <span className="original-price">{formatPaisa(item.originalPricePaisa!)}</span>
                          <span className="savings-badge">Save {savingsPercent}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Automated Notification Switches */}
                  <div className="alerts-control-panel">
                    <div className="alert-toggle-row">
                      <label className="switch-label">
                        <input
                          type="checkbox"
                          checked={item.priceDropAlert}
                          onChange={() => handleTogglePriceAlert(item.id)}
                          className="switch-input"
                        />
                        <span className="switch-slider" />
                      </label>
                      <div className="toggle-text">
                        <span className="toggle-title">Price-Drop Alert</span>
                        <span className="toggle-sub">Instant alert on BDT reduction</span>
                      </div>
                    </div>

                    <div className="alert-toggle-row">
                      <label className="switch-label">
                        <input
                          type="checkbox"
                          checked={item.stockAlert}
                          onChange={() => handleToggleStockAlert(item.id)}
                          className="switch-input"
                        />
                        <span className="switch-slider" />
                      </label>
                      <div className="toggle-text">
                        <span className="toggle-title">Restock / Pre-Order Alert</span>
                        <span className="toggle-sub">Notification when batch arrives</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="card-actions">
                    <button
                      type="button"
                      className="add-to-cart-btn"
                      onClick={() => handleMoveToCart(item)}
                      disabled={item.availability === "OUT_OF_STOCK"}
                    >
                      <span className="cart-icon">🛒</span>
                      <span>{item.availability === "PRE_ORDER" ? "Pre-Order Now" : "Move to Cart"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .wishlist-container {
          max-width: 1240px;
          margin: 0 auto;
          padding: 24px 16px 80px 16px;
          color: #f8fafc;
        }

        .wishlist-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 24px;
        }

        .header-badge-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .badge-pill {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 10px;
          border-radius: 9999px;
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid rgba(244, 63, 94, 0.35);
          color: #f43f5e;
        }

        .spec-tag {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        .wishlist-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin: 0 0 6px 0;
          color: #f8fafc;
        }

        .wishlist-subtitle {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }

        .move-all-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 22px;
          border-radius: 10px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .move-all-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 22px rgba(16, 185, 129, 0.45);
        }

        .move-all-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Metrics Strip */
        .metrics-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-bottom: 32px;
        }

        .metric-box {
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metric-label {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 600;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 800;
          color: #f8fafc;
        }

        .metric-value.in-stock {
          color: #10b981;
        }

        .metric-value.alerts {
          color: #f43f5e;
        }

        .metric-value.quiet {
          font-size: 18px;
          color: #38bdf8;
          font-family: monospace;
          align-self: flex-start;
          margin-top: 4px;
        }

        /* Wishlist Grid */
        .wishlist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        .wishlist-card {
          background: rgba(30, 41, 59, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }

        .wishlist-card:hover {
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .card-media-wrap {
          position: relative;
          height: 200px;
          background: #0f172a;
          overflow: hidden;
        }

        .media-link {
          display: block;
          width: 100%;
          height: 100%;
        }

        .item-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .wishlist-card:hover .item-thumbnail {
          transform: scale(1.05);
        }

        .floating-tier-badge {
          position: absolute;
          top: 12px;
          left: 12px;
        }

        .tier-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 9999px;
          backdrop-filter: blur(8px);
        }

        .tier-tag.authentic {
          background: rgba(245, 158, 11, 0.25);
          border: 1px solid rgba(245, 158, 11, 0.45);
          color: #fbbf24;
        }

        .tier-tag.budget {
          background: rgba(20, 184, 166, 0.25);
          border: 1px solid rgba(20, 184, 166, 0.45);
          color: #2dd4bf;
        }

        .delete-item-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s ease;
        }

        .delete-item-btn:hover {
          background: #ef4444;
          border-color: #ef4444;
          color: #ffffff;
        }

        .card-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        .item-category {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #94a3b8;
        }

        .item-title-link {
          text-decoration: none;
          color: inherit;
        }

        .item-title {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.4;
          color: #f8fafc;
          margin: 0;
          transition: color 0.2s ease;
        }

        .item-title-link:hover .item-title {
          color: #38bdf8;
        }

        .stock-status-row {
          display: flex;
          align-items: center;
        }

        .status-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .status-pill.in-stock {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .status-pill.low-stock {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .status-pill.pre-order {
          background: rgba(14, 165, 233, 0.12);
          color: #38bdf8;
          border: 1px solid rgba(14, 165, 233, 0.25);
        }

        .status-pill.out-of-stock {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .pricing-row {
          margin-top: 4px;
        }

        .price-stack {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }

        .current-price {
          font-size: 20px;
          font-weight: 800;
          color: #f8fafc;
        }

        .drop-info {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .original-price {
          font-size: 13px;
          color: #64748b;
          text-decoration: line-through;
        }

        .savings-badge {
          font-size: 11px;
          font-weight: 800;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.12);
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Control Panel */
        .alerts-control-panel {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 6px 0;
        }

        .alert-toggle-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .switch-label {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
          flex-shrink: 0;
        }

        .switch-input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .switch-slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background-color: rgba(255, 255, 255, 0.15);
          transition: 0.25s;
          border-radius: 20px;
        }

        .switch-slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.25s;
          border-radius: 50%;
        }

        .switch-input:checked + .switch-slider {
          background-color: #f43f5e;
        }

        .switch-input:checked + .switch-slider:before {
          transform: translateX(16px);
        }

        .toggle-text {
          display: flex;
          flex-direction: column;
        }

        .toggle-title {
          font-size: 12px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .toggle-sub {
          font-size: 10px;
          color: #64748b;
        }

        .card-actions {
          margin-top: auto;
          padding-top: 10px;
        }

        .add-to-cart-btn {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f8fafc;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-to-cart-btn:hover:not(:disabled) {
          background: #f59e0b;
          color: #0f172a;
          border-color: #f59e0b;
        }

        .add-to-cart-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Empty state */
        .empty-wishlist-card {
          padding: 64px 24px;
          text-align: center;
          background: rgba(30, 41, 59, 0.3);
          border: 1px dashed rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          max-width: 540px;
          margin: 40px auto 0 auto;
        }

        .empty-heart-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-title {
          font-size: 20px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0 0 8px 0;
        }

        .empty-desc {
          font-size: 14px;
          color: #94a3b8;
          line-height: 1.6;
          margin: 0 0 24px 0;
        }

        .browse-catalog-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 10px;
          background: #f59e0b;
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
          transition: transform 0.2s ease;
        }

        .browse-catalog-cta:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
