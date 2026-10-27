"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  StepIndicator,
  Step1Identity,
  Step2Address,
  Step3Review,
  CustomerIdentity,
  ShippingAddressData,
  CorporateInvoiceData,
  AppliedCoupon,
  CheckoutPricingSummary,
} from "@/components/checkout";
import { CartItem } from "@/components/cart/types";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

const DEFAULT_CHECKOUT_ITEMS: CartItem[] = [
  {
    id: "chk-item-1",
    productId: "prod-1",
    skuId: "sku-1",
    slug: "baseus-65w-gan-ultra-fast-charger",
    title: "Baseus GaN5 Pro 65W Fast Charger",
    tier: "AUTHENTIC",
    variantLabel: "Matte Black • Standard Global Edition",
    pricePaisa: 345000,
    compareAtPricePaisa: 395000,
    quantity: 1,
    thumbnailUrl: "/images/product-main.png",
    isReserved: true,
  },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(isAuthenticated ? 2 : 1);
  const [items] = useState<CartItem[]>(DEFAULT_CHECKOUT_ITEMS);

  // Identity state
  const [identity, setIdentity] = useState<CustomerIdentity>({
    phone: user?.phone || "",
    name: user?.name || "",
    isAuthenticated: isAuthenticated || false,
  });

  // Shipping address state
  const [address, setAddress] = useState<ShippingAddressData>({
    recipientName: user?.name || "Tanvir Rahman",
    phone: user?.phone || "01712345678",
    divisionId: "div-dhaka",
    divisionName: "Dhaka",
    districtId: "dist-dhaka",
    districtName: "Dhaka City",
    thanaId: "thana-kotwali",
    thanaName: "Kotwali (Nawabpur)",
    streetAddress: "House 12, Road 4, Sector 3",
    isPickupCounter: false,
  });

  // Corporate invoice state
  const [corporate, setCorporate] = useState<CorporateInvoiceData>({
    isCorporateRequested: false,
    companyName: "",
    binNumber: "",
  });

  const handleIdentityComplete = (idData: CustomerIdentity) => {
    setIdentity(idData);
    setAddress((prev) => ({
      ...prev,
      recipientName: idData.name || prev.recipientName,
      phone: idData.phone || prev.phone,
    }));
    setCurrentStep(2);
  };

  const handleAddressComplete = (data: {
    address: ShippingAddressData;
    corporate: CorporateInvoiceData;
  }) => {
    setAddress(data.address);
    setCorporate(data.corporate);
    setCurrentStep(3);
  };

  const handleProceedToPayment = (
    summary: CheckoutPricingSummary,
    coupon: AppliedCoupon | null
  ) => {
    toast({
      title: "Order Details Confirmed!",
      description: `Proceeding with total ${coupon ? `(Coupon ${coupon.code} active)` : ""}`,
      variant: "success",
    });

    // In F16, payment selection and place order logic will hook in.
    // For now, redirect or alert
    router.push("/checkout?step=payment");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#080c14",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Distraction-Free Checkout Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "#0b0f19",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1140px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Brand Logo */}
          <Link
            href="/"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #0b0f19 0%, #1e293b 50%, #0d9488 100%)",
                border: "1.5px solid #f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                color: "#ffffff",
                fontSize: "15px",
              }}
            >
              N
            </div>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
              NCA<span style={{ color: "#3b82f6" }}>MART</span>
            </span>
            <span
              style={{
                fontSize: "10px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                padding: "2px 6px",
                borderRadius: "4px",
                color: "#94a3b8",
                fontWeight: 700,
                marginLeft: "4px",
              }}
            >
              SECURE CHECKOUT
            </span>
          </Link>

          {/* Security Assurance Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#10b981" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>256-bit SSL Encrypted</span>
          </div>
        </div>
      </header>

      {/* Main Multi-Step Checkout Body */}
      <main style={{ flex: 1, padding: "32px 16px 64px 16px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          {/* Step Progression Timeline */}
          <StepIndicator
            currentStep={currentStep}
            onStepClick={(step) => setCurrentStep(step)}
          />

          {/* Step 1: Customer Phone & OTP */}
          {currentStep === 1 && (
            <Step1Identity
              initialPhone={identity.phone}
              onComplete={handleIdentityComplete}
            />
          )}

          {/* Step 2: Shipping Address & Geo Cascade */}
          {currentStep === 2 && (
            <Step2Address
              customerName={identity.name}
              customerPhone={identity.phone}
              onBack={() => setCurrentStep(1)}
              onComplete={handleAddressComplete}
            />
          )}

          {/* Step 3: Order Review, Mushak & Coupons */}
          {currentStep === 3 && (
            <Step3Review
              items={items}
              address={address}
              corporate={corporate}
              onBack={() => setCurrentStep(2)}
              onProceedToPayment={handleProceedToPayment}
            />
          )}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          padding: "16px 24px",
          textAlign: "center",
          fontSize: "12px",
          color: "#64748b",
        }}
      >
        Nawabpur Complex Accessories (NCAMart) • 224 Nawabpur Road, Dhaka-1100 • 100% Genuine Certified
      </footer>
    </div>
  );
}
