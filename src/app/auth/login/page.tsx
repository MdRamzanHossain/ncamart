"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StorefrontShell } from "@/components/layout";
import { useAuth } from "@/context/AuthContext";
import { AuthenticBadge } from "@/components/ui/badge";

function LoginPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "";
  const { sendCustomerOtp, verifyCustomerOtp, loginStaff, confirmStaffTotp, isAuthenticated, user, logout } = useAuth();

  const [mode, setMode] = useState<"CUSTOMER" | "STAFF">(
    searchParams.get("mode") === "staff" ? "STAFF" : "CUSTOMER"
  );

  // Customer OTP states
  const [phone, setPhone] = useState("+8801712345678");
  const [otpStep, setOtpStep] = useState<"PHONE" | "VERIFY">("PHONE");
  const [otpCode, setOtpCode] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Staff login states
  const [staffIdentifier, setStaffIdentifier] = useState("mahmudul@ncamart.com");
  const [staffPassword, setStaffPassword] = useState("Nawabpur@2026!");
  const [staffTotp, setStaffTotp] = useState("123456");
  const [staffTempToken, setStaffTempToken] = useState<string | null>(null);
  const [targetPortal, setTargetPortal] = useState<"/admin" | "/pos" | "/runner">("/admin");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const cleanedPhone = phone.replace(/\s+/g, "");
    if (cleanedPhone.length < 10) {
      setErrorMessage("Please enter a valid Bangladesh mobile number (e.g. +8801712345678).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendCustomerOtp(cleanedPhone);
      setOtpStep("VERIFY");
      setOtpCode(res.demoOtp || "123456");
      setStatusMessage(res.message || "6-digit verification code sent via SMS / WhatsApp.");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (otpCode.trim().length !== 6) {
      setErrorMessage("Please enter the 6-digit OTP code.");
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyCustomerOtp(phone.replace(/\s+/g, ""), otpCode.trim());
      router.push(redirectUrl || "/account");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid OTP code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    setIsSubmitting(true);
    try {
      if (staffTempToken) {
        await confirmStaffTotp(staffTempToken, staffTotp);
        router.push(redirectUrl || targetPortal);
        return;
      }

      const res = await loginStaff(staffIdentifier.trim(), staffPassword, staffTotp);
      if (res.requiresTotp && res.tempToken) {
        setStaffTempToken(res.tempToken);
        setStatusMessage("2FA TOTP Enrollment required. Enter your 6-digit authenticator code.");
        return;
      }

      router.push(redirectUrl || targetPortal);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Staff authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "var(--space-2xl) var(--space-md) var(--space-4xl)",
      }}
    >
      {/* Breadcrumb */}
      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-lg)" }}>
        <Link href="/" style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
          Storefront
        </Link>
        {" / "}
        <span style={{ color: "var(--text-secondary)" }}>Identity & Access Portal</span>
      </div>

      {/* Already Authenticated Banner */}
      {isAuthenticated && user && (
        <div
          style={{
            marginBottom: "var(--space-xl)",
            padding: "var(--space-md) var(--space-lg)",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <div style={{ fontWeight: "800", color: "var(--text-primary)", fontSize: "var(--font-size-sm)" }}>
              Signed in as {user.name || user.phone || user.email} ({user.isStaff ? "Staff Backoffice" : "Customer"})
            </div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
              Your session is active. You can proceed directly to your dashboard or switch accounts below.
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <Link
              href={user.isStaff ? "/admin" : "/account"}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-brand-primary)",
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "var(--font-size-xs)",
                textDecoration: "none",
              }}
            >
              Go to {user.isStaff ? "Backoffice" : "My Account"} →
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "transparent",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                fontWeight: "600",
                fontSize: "var(--font-size-xs)",
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "var(--space-2xl)",
          alignItems: "stretch",
        }}
      >
        {/* Left Column: Nawabpur Identity & Security Info */}
        <div
          style={{
            borderRadius: "var(--radius-xl)",
            background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(11, 15, 25, 0.98) 100%)",
            border: "1px solid var(--border-default)",
            padding: "var(--space-2xl)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "var(--space-xl)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
              <AuthenticBadge size="sm" pulse={false} />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Zero-Password Customer Auth
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)",
                fontWeight: "900",
                color: "var(--text-primary)",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
                marginBottom: "var(--space-sm)",
              }}
            >
              Nawabpur Direct Wholesale & Retail Identity
            </h1>

            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Sign in with your verified Bangladesh mobile number to track courier consignments, manage holographic seal
              warranties, settle pre-order balances, and access your Store Credit Wallet.
            </p>

            <div
              style={{
                marginTop: "var(--space-xl)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-md)",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "20px" }}>🛡️</span>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "var(--font-size-sm)", color: "var(--text-primary)" }}>
                    Holographic Seal Warranty Binding
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                    Every 100% Authentic item is cryptographically linked to your phone number upon Godown QC dispatch.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "20px" }}>💳</span>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "var(--font-size-sm)", color: "var(--text-primary)" }}>
                    Instant Store Credit & Pre-Order Ledger
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                    Manage 15% import deposits, 7-day arrival windows, and instant RMA wallet refunds.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "20px" }}>🏪</span>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "var(--font-size-sm)", color: "var(--text-primary)" }}>
                    Showroom Counter 6-Digit Pickup PIN
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                    Collect orders directly at Shop 42, Nawabpur Complex, Sundarban Square Market, Dhaka.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Portal Links */}
          <div
            style={{
              paddingTop: "var(--space-lg)",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-sm)",
            }}
          >
            <Link
              href="/verify"
              style={{
                fontSize: "12px",
                color: "var(--tier-authentic-gold)",
                textDecoration: "none",
                fontWeight: "700",
              }}
            >
              🛡️ Verify Seal →
            </Link>
            <span style={{ color: "var(--border-default)" }}>•</span>
            <Link
              href="/track"
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              📦 Track Consignment →
            </Link>
            <span style={{ color: "var(--border-default)" }}>•</span>
            <Link
              href="/pre-orders"
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              ✈️ Pre-Orders →
            </Link>
          </div>
        </div>

        {/* Right Column: Interactive Login Card */}
        <div
          style={{
            borderRadius: "var(--radius-xl)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            padding: "var(--space-2xl)",
            boxShadow: "var(--shadow-xl)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-lg)",
          }}
        >
          {/* Mode Switcher Tabs */}
          <div
            role="tablist"
            aria-label="Authentication Mode"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              padding: "4px",
              borderRadius: "var(--radius-lg)",
              backgroundColor: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "CUSTOMER"}
              onClick={() => {
                setMode("CUSTOMER");
                setErrorMessage(null);
                setStatusMessage(null);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "none",
                backgroundColor: mode === "CUSTOMER" ? "var(--color-brand-primary)" : "transparent",
                color: mode === "CUSTOMER" ? "#ffffff" : "var(--text-secondary)",
                fontWeight: "700",
                fontSize: "var(--font-size-xs)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              📱 Customer OTP Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "STAFF"}
              onClick={() => {
                setMode("STAFF");
                setErrorMessage(null);
                setStatusMessage(null);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "none",
                backgroundColor: mode === "STAFF" ? "var(--tier-authentic-gold)" : "transparent",
                color: mode === "STAFF" ? "#0b0f19" : "var(--text-secondary)",
                fontWeight: "800",
                fontSize: "var(--font-size-xs)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              🔐 Staff & Backoffice
            </button>
          </div>

          {statusMessage && (
            <div
              role="status"
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(14, 165, 233, 0.12)",
                border: "1px solid rgba(14, 165, 233, 0.35)",
                color: "#38bdf8",
                fontSize: "var(--font-size-xs)",
                fontWeight: "600",
              }}
            >
              {statusMessage}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#f87171",
                fontSize: "var(--font-size-xs)",
                fontWeight: "600",
              }}
            >
              {errorMessage}
            </div>
          )}

          {mode === "CUSTOMER" ? (
            otpStep === "PHONE" ? (
              <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                <div>
                  <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: "800", color: "var(--text-primary)", margin: "0 0 4px" }}>
                    Customer Mobile Sign In
                  </h2>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", margin: 0 }}>
                    We&apos;ll send a 6-digit one-time passcode via SMS & WhatsApp.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label
                    htmlFor="customer-phone"
                    style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--text-secondary)" }}
                  >
                    Bangladesh Mobile Number
                  </label>
                  <input
                    id="customer-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+88017XXXXXXXX"
                    required
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-family-mono)",
                      fontSize: "var(--font-size-sm)",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-brand-primary)",
                    color: "#ffffff",
                    fontWeight: "800",
                    fontSize: "var(--font-size-sm)",
                    border: "none",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px var(--color-brand-primary-glow)",
                  }}
                >
                  {isSubmitting ? "Sending OTP..." : "Send 6-Digit OTP →"}
                </button>

                <div
                  style={{
                    marginTop: "var(--space-xs)",
                    padding: "12px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-surface-elevated)",
                    border: "1px dashed var(--border-default)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                    Instant Demo Customer Login (Engr. Tanvir Ahmed)
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSubmitting(true);
                      try {
                        await verifyCustomerOtp("+8801712345678", "123456");
                        router.push(redirectUrl || "/account");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--tier-budget-teal-bg)",
                      color: "var(--tier-budget-teal)",
                      border: "1px solid var(--tier-budget-teal-border)",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ⚡ Instant Demo Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                <div>
                  <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: "800", color: "var(--text-primary)", margin: "0 0 4px" }}>
                    Verify 6-Digit OTP
                  </h2>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", margin: 0 }}>
                    Sent to <strong style={{ fontFamily: "var(--font-family-mono)" }}>{phone}</strong>
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label
                    htmlFor="otp-code"
                    style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--text-secondary)" }}
                  >
                    6-Digit OTP Code
                  </label>
                  <input
                    id="otp-code"
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    required
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-family-mono)",
                      fontSize: "18px",
                      letterSpacing: "0.25em",
                      textAlign: "center",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-brand-primary)",
                    color: "#ffffff",
                    fontWeight: "800",
                    fontSize: "var(--font-size-sm)",
                    border: "none",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? "Verifying..." : "Verify & Continue to Account →"}
                </button>

                <button
                  type="button"
                  onClick={() => setOtpStep("PHONE")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-tertiary)",
                    fontSize: "var(--font-size-xs)",
                    cursor: "pointer",
                  }}
                >
                  ← Change mobile number
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleStaffLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div>
                <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: "800", color: "var(--text-primary)", margin: "0 0 4px" }}>
                  Operations & Staff Sign In
                </h2>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", margin: 0 }}>
                  Argon2id + 2FA TOTP protected login for Nawabpur Godown, POS, Runner, and Admin staff.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  htmlFor="staff-id"
                  style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--text-secondary)" }}
                >
                  Staff Email or Phone
                </label>
                <input
                  id="staff-id"
                  type="text"
                  value={staffIdentifier}
                  onChange={(e) => setStaffIdentifier(e.target.value)}
                  required
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    fontSize: "var(--font-size-sm)",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  htmlFor="staff-password"
                  style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--text-secondary)" }}
                >
                  Password
                </label>
                <input
                  id="staff-password"
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  required
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    fontSize: "var(--font-size-sm)",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label
                    htmlFor="staff-totp"
                    style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--text-secondary)" }}
                  >
                    2FA TOTP Code
                  </label>
                  <input
                    id="staff-totp"
                    type="text"
                    maxLength={6}
                    value={staffTotp}
                    onChange={(e) => setStaffTotp(e.target.value)}
                    placeholder="123456"
                    style={{
                      padding: "10px 14px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-family-mono)",
                      fontSize: "var(--font-size-sm)",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label
                    htmlFor="staff-destination"
                    style={{ fontSize: "var(--font-size-xs)", fontWeight: "700", color: "var(--text-secondary)" }}
                  >
                    Destination Console
                  </label>
                  <select
                    id="staff-destination"
                    value={targetPortal}
                    onChange={(e) => setTargetPortal(e.target.value as "/admin" | "/pos" | "/runner")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "600",
                    }}
                  >
                    <option value="/admin">👑 Admin Backoffice (/admin)</option>
                    <option value="/pos">🖥️ Showroom Counter POS (/pos)</option>
                    <option value="/runner">🏃 Field Runner PWA (/runner)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "12px 18px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--tier-authentic-gold)",
                  color: "#0b0f19",
                  fontWeight: "800",
                  fontSize: "var(--font-size-sm)",
                  border: "none",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Authenticating..." : `Sign In to ${targetPortal} →`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthLoginPage() {
  return (
    <StorefrontShell>
      <Suspense
        fallback={
          <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading authentication portal...
          </div>
        }
      >
        <LoginPortalContent />
      </Suspense>
    </StorefrontShell>
  );
}

