"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { CustomerIdentity } from "./types";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";

export interface Step1IdentityProps {
  initialPhone?: string;
  onComplete: (identity: CustomerIdentity) => void;
}

export function Step1Identity({ initialPhone = "", onComplete }: Step1IdentityProps) {
  const { toast } = useToast();

  const [phone, setPhone] = useState(initialPhone);
  const [fullName, setFullName] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isRecycledModalOpen, setIsRecycledModalOpen] = useState(false);

  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 60-second cooldown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOtpSent && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [isOtpSent, countdown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phone.trim().replace(/^(\+880|880)/, "0");

    if (!cleanPhone.match(/^01[3-9]\d{8}$/)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 11-digit Bangladesh mobile number (e.g. 01712345678).",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Check if phone matches known demo existing account
      if (cleanPhone === "01711000001" || cleanPhone === "01811000002") {
        setIsRecycledModalOpen(true);
        setIsLoading(false);
        return;
      }

      await api.post("/api/v1/auth/otp/send", { phone: cleanPhone });
      setIsOtpSent(true);
      setCountdown(60);
      toast({
        title: "OTP Code Sent!",
        description: `6-digit verification code sent via SMS to +88${cleanPhone}.`,
        variant: "success",
      });

      // Focus first input
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== "production") {
        // In local dev without live SMS gateway, allow demo fallback
        setIsOtpSent(true);
        setCountdown(60);
        toast({
          title: "Test OTP Mode",
          description: "Dev environment: Use 123456 as verification code.",
          variant: "info",
        });
        setTimeout(() => {
          digitInputRefs.current[0]?.focus();
        }, 100);
      } else {
        toast({
          title: "Failed to Send OTP",
          description: err instanceof Error ? err.message : "Could not send verification SMS. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const digit = val.slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    // Auto-advance
    if (digit && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }

    // Auto submit if complete
    if (digit && index === 5 && updated.every((d) => d.length === 1)) {
      verifyCode(updated.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split("");
      setOtpDigits(digits);
      digitInputRefs.current[5]?.focus();
      verifyCode(pasted);
    }
  };

  const verifyCode = useCallback(
    async (code: string) => {
      setIsLoading(true);
      const cleanPhone = phone.trim().replace(/^(\+880|880)/, "0");

      try {
        await api.post("/api/v1/auth/otp/verify", {
          phone: cleanPhone,
          otp_code: code,
        });

        toast({
          title: "Phone Verified!",
          description: "Proceeding to shipping address details.",
          variant: "success",
        });

        onComplete({
          phone: cleanPhone,
          name: fullName || "Valued Customer",
          isAuthenticated: true,
        });
      } catch {
        // Fallback for dev code "123456" only in non-production
        if (process.env.NODE_ENV !== "production" && code === "123456") {
          toast({
            title: "Phone Verified (Dev)",
            description: "Dev mock OTP verified.",
            variant: "success",
          });
          onComplete({
            phone: cleanPhone,
            name: fullName || "Valued Customer",
            isAuthenticated: true,
          });
        } else {
          toast({
            title: "Verification Failed",
            description: "Invalid or expired OTP code. Please check and try again.",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [fullName, onComplete, phone, toast]
  );

  return (
    <div
      style={{
        maxWidth: "520px",
        margin: "0 auto",
        padding: "24px",
        borderRadius: "16px",
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#f8fafc", margin: 0 }}>
          Step 1: Contact & Identity
        </h2>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: "6px 0 0 0" }}>
          We use your mobile number to send tracking updates and order confirmation.
        </p>
      </div>

      {!isOtpSent ? (
        <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Full Name */}
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px", fontWeight: 600 }}>
              Full Name (Optional)
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Tanvir Rahman"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "10px",
                backgroundColor: "#0d131f",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px", fontWeight: 600 }}>
              Mobile Number (Bangladesh) *
            </label>
            <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: "14px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  fontFamily: "monospace",
                }}
              >
                +88
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px 12px 48px",
                  borderRadius: "10px",
                  backgroundColor: "#0d131f",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#f8fafc",
                  fontSize: "15px",
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
            </div>
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
              We will send a 6-digit OTP code to verify your phone.
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: "14px",
              borderRadius: "10px",
              backgroundColor: "#3b82f6",
              color: "#ffffff",
              border: "none",
              fontSize: "14px",
              fontWeight: 800,
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "background-color 0.2s ease",
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span>{isLoading ? "Sending Code..." : "Continue with OTP →"}</span>
          </button>
        </form>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Verification code sent to:</span>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc", fontFamily: "monospace" }}>
                +88 {phone}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOtpSent(false)}
              style={{
                background: "none",
                border: "none",
                color: "#38bdf8",
                fontSize: "12px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Change
            </button>
          </div>

          {/* 6 Auto-Focus Digit Boxes with Paste Support */}
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "8px", fontWeight: 600 }}>
              Enter 6-Digit OTP Code
            </label>
            <div
              onPaste={handlePaste}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: "8px",
              }}
            >
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    digitInputRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  style={{
                    width: "100%",
                    height: "50px",
                    textAlign: "center",
                    fontSize: "20px",
                    fontWeight: 800,
                    fontFamily: "monospace",
                    borderRadius: "10px",
                    backgroundColor: "#0d131f",
                    border: d ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#f8fafc",
                    outline: "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Cooldown Timer & Resend Button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
            {countdown > 0 ? (
              <span style={{ color: "#94a3b8" }}>
                Resend code in <strong style={{ color: "#f8fafc" }}>{countdown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isLoading}
                style={{
                  background: "none",
                  border: "none",
                  color: "#38bdf8",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Resend Code Now
              </button>
            )}

            <button
              type="button"
              onClick={() => verifyCode(otpDigits.join(""))}
              disabled={isLoading || otpDigits.some((d) => !d)}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                backgroundColor: otpDigits.every((d) => d) ? "#10b981" : "#1e293b",
                color: "#ffffff",
                border: "none",
                fontSize: "13px",
                fontWeight: 700,
                cursor: otpDigits.every((d) => d) ? "pointer" : "not-allowed",
              }}
            >
              Verify & Proceed →
            </button>
          </div>
        </div>
      )}

      {/* Recycled Phone / Existing Account Merge Dialog */}
      <Dialog
        isOpen={isRecycledModalOpen}
        onClose={() => setIsRecycledModalOpen(false)}
        title="Existing Account Detected"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", color: "#cbd5e1" }}>
          <p style={{ fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
            An existing NCAMart customer account is linked to{" "}
            <strong style={{ color: "#f8fafc" }}>+88 {phone}</strong>.
          </p>
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              fontSize: "12px",
              color: "#f59e0b",
            }}
          >
            If you recently purchased this SIM, you can claim ownership via OTP, or continue as a new order.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => {
                setIsRecycledModalOpen(false);
                setIsOtpSent(true);
                setCountdown(60);
              }}
              style={{
                padding: "12px",
                borderRadius: "8px",
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                border: "none",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Verify OTP to Link Order to History
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRecycledModalOpen(false);
                onComplete({
                  phone,
                  name: fullName || "Guest Customer",
                  isAuthenticated: false,
                });
              }}
              style={{
                padding: "12px",
                borderRadius: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                color: "#cbd5e1",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue as Guest (No Past Linking)
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
