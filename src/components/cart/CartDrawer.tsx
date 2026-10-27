"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Drawer } from "@/components/ui/drawer";
import { CartItem, CartDrawerProps } from "./types";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

const FREE_SHIPPING_THRESHOLD_PAISA = 400000; // ৳4,000 threshold
const RESERVATION_DURATION_SECONDS = 900; // 15 minutes = 900 seconds

const DEFAULT_DEMO_ITEMS: CartItem[] = [
  {
    id: "cart-item-1",
    productId: "prod-1",
    skuId: "sku-1",
    slug: "baseus-65w-gan-ultra-fast-charger",
    title: "Baseus GaN5 Pro 65W Fast Charger",
    tier: "AUTHENTIC",
    variantLabel: "Matte Black • Standard Edition",
    pricePaisa: 345000,
    compareAtPricePaisa: 395000,
    quantity: 1,
    thumbnailUrl: "/images/product-main.png",
    isReserved: true,
  },
];

export function CartDrawer({
  isOpen,
  onClose,
  items: initialItems,
  onUpdateQuantity,
  onRemoveItem,
}: CartDrawerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [cartItems, setCartItems] = useState<CartItem[]>(initialItems || DEFAULT_DEMO_ITEMS);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(RESERVATION_DURATION_SECONDS);
  const [isTimerExpired, setIsTimerExpired] = useState(false);

  // Sync when initialItems prop changes
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setCartItems(initialItems);
    }
  }, [initialItems]);

  // Listen for custom "ncamart:cart-add" events from PDP or ProductCards
  useEffect(() => {
    const handleCartAdd = (e: Event) => {
      const customEvent = e as CustomEvent<{
        productId: string;
        skuId: string;
        quantity: number;
        pricePaisa: number;
        title: string;
      }>;
      if (customEvent.detail) {
        const d = customEvent.detail;
        setCartItems((prev) => {
          const existing = prev.find((item) => item.skuId === d.skuId);
          if (existing) {
            return prev.map((item) =>
              item.skuId === d.skuId
                ? { ...item, quantity: item.quantity + d.quantity }
                : item
            );
          }
          return [
            ...prev,
            {
              id: `item-${Date.now()}`,
              productId: d.productId,
              skuId: d.skuId,
              slug: d.skuId.toLowerCase(),
              title: d.title,
              tier: "AUTHENTIC",
              variantLabel: "Standard Edition",
              pricePaisa: d.pricePaisa,
              quantity: d.quantity,
              thumbnailUrl: "/images/product-main.png",
              isReserved: true,
            },
          ];
        });
        // Reset timer on new add
        setSecondsRemaining(RESERVATION_DURATION_SECONDS);
        setIsTimerExpired(false);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("ncamart:cart-add", handleCartAdd);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("ncamart:cart-add", handleCartAdd);
      }
    };
  }, []);

  // 15-Minute Reservation Countdown Timer
  useEffect(() => {
    if (!isOpen || cartItems.length === 0 || isTimerExpired) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, cartItems.length, isTimerExpired]);

  // Subtotal Calculation
  const subtotalPaisa = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.pricePaisa * item.quantity, 0);
  }, [cartItems]);

  const estimatedDeliveryPaisa = subtotalPaisa > 0 ? (subtotalPaisa >= FREE_SHIPPING_THRESHOLD_PAISA ? 0 : 6000) : 0;
  const isFreeDelivery = estimatedDeliveryPaisa === 0 && subtotalPaisa > 0;
  const deliveryShortfallPaisa = Math.max(0, FREE_SHIPPING_THRESHOLD_PAISA - subtotalPaisa);
  const freeShippingProgress = Math.min(100, Math.round((subtotalPaisa / FREE_SHIPPING_THRESHOLD_PAISA) * 100));

  // Timer Formatting (MM:SS)
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  const isTimerCritical = secondsRemaining <= 120 && secondsRemaining > 0;

  // Handlers
  const handleQuantityChange = useCallback(
    (id: string, delta: number) => {
      setCartItems((prev) =>
        prev
          .map((item) => {
            if (item.id === id) {
              const newQty = Math.max(1, Math.min(10, item.quantity + delta));
              if (onUpdateQuantity) onUpdateQuantity(id, newQty);
              return { ...item, quantity: newQty };
            }
            return item;
          })
      );
    },
    [onUpdateQuantity]
  );

  const handleRemove = (id: string) => {
    const itemIndex = cartItems.findIndex((it) => it.id === id);
    if (itemIndex === -1) return;
    const removedItem = cartItems[itemIndex];

    setCartItems((prev) => prev.filter((it) => it.id !== id));
    if (onRemoveItem) onRemoveItem(id);

    toast({
      title: "Item removed from cart",
      description: `${removedItem.title} removed`,
      variant: "neutral",
      undoLabel: "Undo",
      onUndo: () => {
        setCartItems((prev) => {
          const clone = [...prev];
          clone.splice(itemIndex, 0, removedItem);
          return clone;
        });
      },
    });
  };

  const handleRenewReservation = () => {
    setSecondsRemaining(RESERVATION_DURATION_SECONDS);
    setIsTimerExpired(false);
    toast({
      title: "Reservation Renewed",
      description: "Physical stock hold extended for another 15 minutes.",
      variant: "success",
    });
  };

  const handleCheckoutClick = () => {
    onClose();
    router.push("/checkout");
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} position="right" size="md">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          backgroundColor: "#0b0f19",
          color: "#f8fafc",
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>🛒</span>
            <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>
              Shopping Cart ({cartItems.reduce((acc, it) => acc + it.quantity, 0)})
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart drawer"
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Free Shipping Progress Rail */}
        <div
          style={{
            padding: "12px 24px",
            backgroundColor: "rgba(59, 130, 246, 0.05)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
            {isFreeDelivery ? (
              <span style={{ color: "#10b981", fontWeight: 700 }}>
                🎉 You have unlocked Free Dhaka Delivery!
              </span>
            ) : (
              <span style={{ color: "#cbd5e1" }}>
                Add <strong style={{ color: "#38bdf8" }}>{formatPaisa(deliveryShortfallPaisa)}</strong> more for Free Dhaka Delivery
              </span>
            )}
            <span style={{ color: "#94a3b8", fontWeight: 600 }}>{freeShippingProgress}%</span>
          </div>

          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderRadius: "3px",
              marginTop: "8px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${freeShippingProgress}%`,
                height: "100%",
                background: isFreeDelivery
                  ? "linear-gradient(90deg, #10b981, #059669)"
                  : "linear-gradient(90deg, #3b82f6, #0ea5e9)",
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* 15-Minute Reservation Countdown Bar */}
        {cartItems.length > 0 && (
          <div
            style={{
              padding: "10px 24px",
              backgroundColor: isTimerExpired
                ? "rgba(239, 68, 68, 0.12)"
                : isTimerCritical
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(16, 185, 129, 0.08)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: isTimerExpired ? "#ef4444" : isTimerCritical ? "#f59e0b" : "#10b981",
                  boxShadow: isTimerCritical ? "0 0 8px #f59e0b" : "none",
                }}
              />
              {isTimerExpired ? (
                <span style={{ color: "#fca5a5", fontWeight: 600 }}>
                  Stock reservation expired! Items may be claimed by others.
                </span>
              ) : (
                <span style={{ color: isTimerCritical ? "#fef08a" : "#cbd5e1" }}>
                  Stock reserved for{" "}
                  <strong style={{ color: isTimerCritical ? "#f59e0b" : "#f8fafc", fontFamily: "monospace" }}>
                    {formatTimer(secondsRemaining)}
                  </strong>{" "}
                  minutes
                </span>
              )}
            </div>

            {isTimerExpired && (
              <button
                type="button"
                onClick={handleRenewReservation}
                style={{
                  background: "none",
                  border: "none",
                  color: "#38bdf8",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Renew Hold
              </button>
            )}
          </div>
        )}

        {/* Cart Item Rows List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {cartItems.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                textAlign: "center",
                color: "#94a3b8",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "48px" }}>🛍️</span>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                Your cart is empty
              </h3>
              <p style={{ fontSize: "13px", maxWidth: "260px", margin: 0, lineHeight: 1.5 }}>
                Browse our verified catalog from Nawabpur Complex and add authentic components.
              </p>
              <Link
                href="/products"
                onClick={onClose}
                style={{
                  marginTop: "8px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  backgroundColor: "#3b82f6",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Explore Products
              </Link>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "14px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  position: "relative",
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  <span style={{ fontSize: "28px" }}>⚡</span>
                </div>

                {/* Details */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={onClose}
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#f8fafc",
                        textDecoration: "none",
                        lineHeight: 1.3,
                      }}
                    >
                      {item.title}
                    </Link>

                    {/* Delete Item Button */}
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      aria-label={`Remove ${item.title}`}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        padding: "2px",
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>

                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {item.variantLabel}
                  </span>

                  {/* Tier Pill */}
                  <div style={{ marginTop: "2px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "10px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor:
                          item.tier === "AUTHENTIC"
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(20, 184, 166, 0.15)",
                        color: item.tier === "AUTHENTIC" ? "#f59e0b" : "#14b8a6",
                      }}
                    >
                      {item.tier === "AUTHENTIC" ? "100% Authentic" : "Budget Smart (OEM)"}
                    </span>
                  </div>

                  {/* Quantity Stepper & Price Row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        backgroundColor: "#0d131f",
                        overflow: "hidden",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, -1)}
                        style={{
                          padding: "3px 8px",
                          background: "none",
                          border: "none",
                          color: "#cbd5e1",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          padding: "2px 8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#f8fafc",
                          minWidth: "24px",
                          textAlign: "center",
                        }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, 1)}
                        style={{
                          padding: "3px 8px",
                          background: "none",
                          border: "none",
                          color: "#cbd5e1",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 800,
                          color: item.tier === "AUTHENTIC" ? "#f59e0b" : "#14b8a6",
                        }}
                      >
                        {formatPaisa(item.pricePaisa * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary & Checkout Footer */}
        {cartItems.length > 0 && (
          <div
            style={{
              padding: "20px 24px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Calculation Lines */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                <span>Subtotal</span>
                <span style={{ color: "#f8fafc", fontWeight: 600 }}>{formatPaisa(subtotalPaisa)}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                <span>Estimated Dhaka Courier</span>
                <span style={{ color: isFreeDelivery ? "#10b981" : "#f8fafc", fontWeight: 600 }}>
                  {isFreeDelivery ? "FREE" : formatPaisa(estimatedDeliveryPaisa)}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#f8fafc",
                  fontSize: "16px",
                  fontWeight: 800,
                  paddingTop: "8px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <span>Estimated Total</span>
                <span style={{ color: "#38bdf8" }}>
                  {formatPaisa(subtotalPaisa + estimatedDeliveryPaisa)}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              type="button"
              onClick={handleCheckoutClick}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: "10px",
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                border: "none",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 15px rgba(59, 130, 246, 0.35)",
                transition: "background-color 0.2s ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Proceed to Checkout</span>
              <span>→</span>
            </button>

            <div style={{ textAlign: "center", fontSize: "11px", color: "#94a3b8" }}>
              🔒 Bank-grade 256-bit SSL encrypted • 100% Nawabpur Guarantee
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
