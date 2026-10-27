"use client";

import React, { useState } from "react";
import { CartItem } from "@/components/cart/types";
import { ShippingAddressData, CorporateInvoiceData, AppliedCoupon, CheckoutPricingSummary } from "./types";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";

export interface Step3ReviewProps {
  items: CartItem[];
  address: ShippingAddressData;
  corporate: CorporateInvoiceData;
  onBack: () => void;
  onProceedToPayment: (summary: CheckoutPricingSummary, coupon: AppliedCoupon | null) => void;
}

export function Step3Review({
  items,
  address,
  corporate,
  onBack,
  onProceedToPayment,
}: Step3ReviewProps) {
  const { toast } = useToast();

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Subtotal in paisa
  const subtotalPaisa = items.reduce((acc, item) => acc + item.pricePaisa * item.quantity, 0);

  // Delivery Fee calculation
  const isPickup = address.isPickupCounter;
  const isFreeThreshold = subtotalPaisa >= 400000; // >= ৳4,000
  const isInsideDhaka = address.divisionName.toLowerCase().includes("dhaka");
  const deliveryFeePaisa = isPickup ? 0 : isFreeThreshold ? 0 : isInsideDhaka ? 6000 : 12000;

  // Inclusive VAT breakdown (15% standard rate)
  const vatIncludedPaisa = Math.round(subtotalPaisa * (1500 / 11500));

  // Coupon discount
  const couponDiscountPaisa = appliedCoupon ? appliedCoupon.discountPaisa : 0;
  const totalPaisa = Math.max(0, subtotalPaisa + deliveryFeePaisa - couponDiscountPaisa);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = couponCode.trim().toUpperCase();
    if (!cleanCode) return;

    setIsValidatingCoupon(true);
    setCouponError(null);

    setTimeout(() => {
      setIsValidatingCoupon(false);

      if (cleanCode === "NAWABPUR10") {
        const discount = Math.min(50000, Math.round(subtotalPaisa * 0.1)); // 10% up to ৳500
        setAppliedCoupon({
          code: cleanCode,
          discountPaisa: discount,
          description: "10% Nawabpur Welcome Discount (Max ৳500)",
        });
        toast({
          title: "Coupon Applied!",
          description: `Saved ${formatPaisa(discount)} with ${cleanCode}.`,
          variant: "success",
        });
      } else if (cleanCode === "FIRSTBUY") {
        if (subtotalPaisa < 100000) {
          setCouponError("Minimum order of ৳1,000 required for FIRSTBUY.");
          return;
        }
        setAppliedCoupon({
          code: cleanCode,
          discountPaisa: 15000, // ৳150
          description: "৳150 Off First Purchase",
        });
        toast({
          title: "Coupon Applied!",
          description: `Saved ${formatPaisa(15000)} with ${cleanCode}.`,
          variant: "success",
        });
      } else {
        setCouponError("Invalid or expired coupon code. Non-stackable with other promotions.");
        toast({
          title: "Coupon Not Valid",
          description: "The code you entered does not exist or has expired.",
          variant: "destructive",
        });
      }
    }, 350);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
    toast({ title: "Coupon Removed", description: "Coupon discount removed from total.", variant: "neutral" });
  };

  const handleProceed = () => {
    onProceedToPayment(
      {
        subtotalPaisa,
        deliveryFeePaisa,
        vatIncludedPaisa,
        couponDiscountPaisa,
        storeCreditPaisa: 0,
        totalPaisa,
      },
      appliedCoupon
    );
  };

  return (
    <div
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Step Header */}
      <div>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#f8fafc", margin: 0 }}>
          Step 3: Review & Final Confirmation
        </h2>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: "6px 0 0 0" }}>
          Verify your items, delivery destination, and apply discount vouchers.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Left Column: Itemized Order & Delivery Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Destination Brief Card */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                Delivery Destination
              </span>
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "#3b82f6",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Edit
              </button>
            </div>

            <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
              {address.recipientName} • {address.phone}
            </div>
            <div style={{ fontSize: "13px", color: "#cbd5e1", marginTop: "4px", lineHeight: 1.5 }}>
              {address.streetAddress}, {address.thanaName}, {address.districtName}, {address.divisionName}
            </div>

            {corporate.isCorporateRequested && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(59, 130, 246, 0.08)",
                  fontSize: "12px",
                  color: "#93c5fd",
                }}
              >
                🏢 Corporate Invoice: <strong>{corporate.companyName}</strong> (BIN: {corporate.binNumber})
              </div>
            )}
          </div>

          {/* Itemized List */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              Order Items ({items.reduce((acc, it) => acc + it.quantity, 0)})
            </span>

            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "6px",
                      backgroundColor: "#0d131f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      flexShrink: 0,
                    }}
                  >
                    ⚡
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      Qty: {item.quantity} • {item.variantLabel}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: item.tier === "AUTHENTIC" ? "#f59e0b" : "#14b8a6",
                  }}
                >
                  {formatPaisa(item.pricePaisa * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Coupons, Price Breakdown, CTAs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Coupon Code Input Card */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              Discount Coupon Voucher
            </span>

            {!appliedCoupon ? (
              <form onSubmit={handleApplyCoupon} style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter code (e.g. NAWABPUR10)"
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    textTransform: "uppercase",
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={isValidatingCoupon || !couponCode.trim()}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    backgroundColor: "#3b82f6",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: isValidatingCoupon || !couponCode.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {isValidatingCoupon ? "..." : "Apply"}
                </button>
              </form>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  marginTop: "10px",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#10b981", fontFamily: "monospace" }}>
                    ✓ {appliedCoupon.code}
                  </div>
                  <div style={{ fontSize: "11px", color: "#cbd5e1" }}>
                    {appliedCoupon.description} (-{formatPaisa(appliedCoupon.discountPaisa)})
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    fontSize: "12px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Remove
                </button>
              </div>
            )}

            {couponError && (
              <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "8px" }}>
                {couponError}
              </div>
            )}
          </div>

          {/* Pricing Summary Card */}
          <div
            style={{
              padding: "20px",
              borderRadius: "14px",
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#94a3b8" }}>
              <span>Items Subtotal</span>
              <span style={{ color: "#f8fafc", fontWeight: 600 }}>{formatPaisa(subtotalPaisa)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#94a3b8" }}>
              <span>Estimated Delivery Fee</span>
              <span style={{ color: deliveryFeePaisa === 0 ? "#10b981" : "#f8fafc", fontWeight: 600 }}>
                {deliveryFeePaisa === 0 ? "FREE" : formatPaisa(deliveryFeePaisa)}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b" }}>
              <span>VAT / Mushak (15% inclusive)</span>
              <span>{formatPaisa(vatIncludedPaisa)}</span>
            </div>

            {appliedCoupon && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#10b981" }}>
                <span>Coupon ({appliedCoupon.code})</span>
                <span style={{ fontWeight: 700 }}>-{formatPaisa(couponDiscountPaisa)}</span>
              </div>
            )}

            {/* Total Line */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingTop: "12px",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                marginTop: "4px",
              }}
            >
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc" }}>
                Total Payable
              </span>
              <span style={{ fontSize: "24px", fontWeight: 900, color: "#38bdf8" }}>
                {formatPaisa(totalPaisa)}
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={onBack}
                style={{
                  padding: "12px 18px",
                  borderRadius: "10px",
                  background: "none",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#cbd5e1",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleProceed}
                style={{
                  flex: 1,
                  padding: "14px 20px",
                  borderRadius: "10px",
                  backgroundColor: "#10b981",
                  color: "#022c22",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 15px rgba(16, 185, 129, 0.35)",
                }}
              >
                <span>Proceed to Payment</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
