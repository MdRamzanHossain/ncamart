"use client";

import React, { useState } from "react";
import { CodEligibilityMeter, CodStatus } from "./CodEligibilityMeter";
import { formatPaisa } from "@/lib/money";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

export type PaymentMode = "ONLINE_FULL" | "COD" | "STORE_CREDIT" | "PAY_AT_COUNTER";

export interface PaymentMethodSelectorProps {
  totalPayablePaisa: number;
  isPickupCounter?: boolean;
  storeCreditBalancePaisa?: number;
  codStatus?: CodStatus;
  advanceDeliveryFeePaisa?: number;
  onPlaceOrder: (paymentMode: PaymentMode, idempotencyKey: string) => Promise<{
    orderNumber: string;
    gatewayUrl?: string;
  }>;
}

export function PaymentMethodSelector({
  totalPayablePaisa,
  isPickupCounter = false,
  storeCreditBalancePaisa = 0,
  codStatus = "ADVANCE_FEE_REQUIRED",
  advanceDeliveryFeePaisa = 12000,
  onPlaceOrder,
}: PaymentMethodSelectorProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMode>(
    isPickupCounter ? "PAY_AT_COUNTER" : "ONLINE_FULL"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const isCodBlocked = codStatus === "COD_BLOCKED";
  const hasStoreCredit = storeCreditBalancePaisa > 0;

  const handleSelectMethod = (mode: PaymentMode) => {
    if (mode === "COD" && isCodBlocked) {
      toast({
        title: "COD Unavailable",
        description: "Cash on Delivery is unavailable for this account. Please select Online Payment.",
        variant: "warning",
      });
      return;
    }
    setSelectedMethod(mode);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!agreedToTerms) {
      toast({
        title: "Terms Agreement Required",
        description: "Please accept the Nawabpur Complex authenticity & return policy terms to proceed.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    // Generate UUIDv7 / standard UUID for idempotency
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      const response = await onPlaceOrder(selectedMethod, idempotencyKey);

      if (selectedMethod === "ONLINE_FULL" && response.gatewayUrl) {
        // Redirect to SSLCommerz Payment Gateway
        window.location.href = response.gatewayUrl;
      } else {
        // Direct order confirmation
        router.push(`/checkout/success/${response.orderNumber}`);
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      const errorMessage = err instanceof Error ? err.message : "Order submission failed";
      toast({
        title: "Checkout Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        borderRadius: "14px",
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc", margin: 0 }}>
          Select Payment Method
        </h3>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
          Total: <strong style={{ color: "#38bdf8" }}>{formatPaisa(totalPayablePaisa)}</strong>
        </span>
      </div>

      {/* Payment Options Accordion Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Option A: Online Payment (SSLCommerz) */}
        <div
          onClick={() => handleSelectMethod("ONLINE_FULL")}
          style={{
            padding: "16px",
            borderRadius: "10px",
            cursor: "pointer",
            border:
              selectedMethod === "ONLINE_FULL"
                ? "2px solid #3b82f6"
                : "1px solid rgba(255, 255, 255, 0.1)",
            backgroundColor:
              selectedMethod === "ONLINE_FULL"
                ? "rgba(59, 130, 246, 0.1)"
                : "rgba(255, 255, 255, 0.02)",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="radio"
                name="paymentMethod"
                checked={selectedMethod === "ONLINE_FULL"}
                onChange={() => handleSelectMethod("ONLINE_FULL")}
                style={{ accentColor: "#3b82f6", cursor: "pointer" }}
              />
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                  Instant Online Payment (Recommended)
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                  bKash, Nagad, Rocket, Upay, Visa, MasterCard, AMEX
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                color: "#10b981",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              ZERO FEES
            </span>
          </div>

          {selectedMethod === "ONLINE_FULL" && (
            <div
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: "12px",
                color: "#cbd5e1",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>🔒 You will be securely redirected to SSLCommerz 256-bit payment gateway.</span>
            </div>
          )}
        </div>

        {/* Option B: Cash on Delivery (COD) */}
        {!isPickupCounter && (
          <div
            onClick={() => handleSelectMethod("COD")}
            style={{
              padding: "16px",
              borderRadius: "10px",
              cursor: isCodBlocked ? "not-allowed" : "pointer",
              opacity: isCodBlocked ? 0.6 : 1,
              border:
                selectedMethod === "COD"
                  ? "2px solid #f59e0b"
                  : "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor:
                selectedMethod === "COD"
                  ? "rgba(245, 158, 11, 0.1)"
                  : "rgba(255, 255, 255, 0.02)",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={selectedMethod === "COD"}
                  disabled={isCodBlocked}
                  onChange={() => handleSelectMethod("COD")}
                  style={{ accentColor: "#f59e0b", cursor: isCodBlocked ? "not-allowed" : "pointer" }}
                />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                    Cash on Delivery (COD)
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    Pay courier agent at your door after physical seal inspection
                  </div>
                </div>
              </div>
            </div>

            {selectedMethod === "COD" && (
              <div style={{ marginTop: "14px" }}>
                <CodEligibilityMeter
                  status={codStatus}
                  advanceFeePaisa={advanceDeliveryFeePaisa}
                />
              </div>
            )}
          </div>
        )}

        {/* Option C: Store Credit (if available) */}
        {hasStoreCredit && (
          <div
            onClick={() => handleSelectMethod("STORE_CREDIT")}
            style={{
              padding: "16px",
              borderRadius: "10px",
              cursor: "pointer",
              border:
                selectedMethod === "STORE_CREDIT"
                  ? "2px solid #14b8a6"
                  : "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor:
                selectedMethod === "STORE_CREDIT"
                  ? "rgba(20, 184, 166, 0.1)"
                  : "rgba(255, 255, 255, 0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={selectedMethod === "STORE_CREDIT"}
                  onChange={() => handleSelectMethod("STORE_CREDIT")}
                  style={{ accentColor: "#14b8a6", cursor: "pointer" }}
                />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                    NCAMart Store Credit Balance
                  </div>
                  <div style={{ fontSize: "11px", color: "#14b8a6", marginTop: "2px" }}>
                    Available wallet balance: {formatPaisa(storeCreditBalancePaisa)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Option D: Pay at Counter (for showroom pickup) */}
        {isPickupCounter && (
          <div
            onClick={() => handleSelectMethod("PAY_AT_COUNTER")}
            style={{
              padding: "16px",
              borderRadius: "10px",
              cursor: "pointer",
              border:
                selectedMethod === "PAY_AT_COUNTER"
                  ? "2px solid #10b981"
                  : "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor:
                selectedMethod === "PAY_AT_COUNTER"
                  ? "rgba(16, 185, 129, 0.1)"
                  : "rgba(255, 255, 255, 0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="radio"
                name="paymentMethod"
                checked={selectedMethod === "PAY_AT_COUNTER"}
                onChange={() => handleSelectMethod("PAY_AT_COUNTER")}
                style={{ accentColor: "#10b981", cursor: "pointer" }}
              />
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                  Pay at Nawabpur Counter #42 (Cash / Card POS)
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                  Pay in-person during bench testing inspection
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Terms Agreement Checkbox */}
      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", fontSize: "12px", color: "#cbd5e1" }}>
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          style={{ width: "16px", height: "16px", accentColor: "#3b82f6", marginTop: "2px", cursor: "pointer" }}
        />
        <span>
          I agree to NCAMart terms, warranty conditions, and understand that all units include serialized holographic seals inspected at Nawabpur Complex.
        </span>
      </label>

      {/* Final Place Order CTA Button with Double-Click Idempotency Lock */}
      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          width: "100%",
          padding: "16px 24px",
          borderRadius: "12px",
          backgroundColor: isSubmitting ? "#1e293b" : "#3b82f6",
          color: "#ffffff",
          border: "none",
          fontSize: "16px",
          fontWeight: 800,
          cursor: isSubmitting ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          boxShadow: isSubmitting ? "none" : "0 4px 20px rgba(59, 130, 246, 0.4)",
          transition: "all 0.2s ease",
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>
          {isSubmitting
            ? "Securing Stock & Placing Order..."
            : `Confirm & Place Order (${formatPaisa(totalPayablePaisa)}) →`}
        </span>
      </button>
    </form>
  );
}
