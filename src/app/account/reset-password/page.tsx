"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ChannelType = "sms" | "whatsapp" | "email";
type StepType = "IDENTIFIER" | "VERIFY" | "SUCCESS";

export default function ResetPasswordPage() {
  const router = useRouter();

  // Form states
  const [step, setStep] = useState<StepType>("IDENTIFIER");
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState<ChannelType>("sms");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    destination?: string;
    whatsappLink?: string;
    demoOtp?: string;
    message?: string;
  } | null>(null);

  // Resend Countdown
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Success redirect countdown
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "VERIFY" && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendTimer]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "SUCCESS" && redirectCountdown > 0) {
      timer = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            router.push("/auth/login");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, redirectCountdown, router]);

  // Handle Request OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage("Please enter your registered phone number or email address.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/v1/auth/password/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), channel }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send reset code. Please try again.");
      }

      setSuccessInfo({
        destination: data.destination,
        whatsappLink: data.whatsappLink,
        demoOtp: data.demoOtp,
        message: data.message,
      });

      if (data.demoOtp) {
        setOtp(data.demoOtp);
      }

      setStep("VERIFY");
      setResendTimer(60);
      setCanResend(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Confirm Reset
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!otp.trim()) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please verify both fields.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/password/reset-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp: otp.trim(),
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password. Please check the code.");
      }

      setStep("SUCCESS");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="reset-container">
      <div className="reset-card">
        {/* Brand Header */}
        <div className="brand-header">
          <Link href="/" className="logo-link">
            <span className="logo-badge">N</span>
            <span className="logo-text">NCAMart</span>
          </Link>
          <div className="security-tag">
            <span className="tag-dot" />
            <span>ACCOUNT RECOVERY & SECURITY</span>
          </div>
        </div>

        {/* Dynamic Title */}
        <div className="card-heading">
          {step === "IDENTIFIER" && (
            <>
              <h1>Forgot Your Password?</h1>
              <p>পাসওয়ার্ড রিসেট করতে আপনার রেজিস্টার্ড ফোন অথবা ইমেইল দিন।</p>
            </>
          )}
          {step === "VERIFY" && (
            <>
              <h1>Enter Verification Code</h1>
              <p>
                আমরা {successInfo?.destination || "আপনার ঠিকানায়"} একটি ভেরিফিকেশন কোড পাঠিয়েছি।
              </p>
            </>
          )}
          {step === "SUCCESS" && (
            <>
              <h1>Password Updated!</h1>
              <p>আপনার পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে।</p>
            </>
          )}
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="alert-box error">
            <svg className="alert-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: IDENTIFIER & CHANNEL SELECTOR */}
        {step === "IDENTIFIER" && (
          <form onSubmit={handleRequestOtp} className="reset-form">
            <div className="input-group">
              <label htmlFor="identifier">
                Phone Number or Email <span className="req">*</span>
              </label>
              <div className="input-field-wrapper">
                <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  id="identifier"
                  type="text"
                  placeholder="e.g. 01712345678 or name@domain.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <span className="helper-text">
                User অথবা Staff অ্যাকাউন্ট যা দিয়ে আপনি পূর্বে রেজিস্ট্রেশন করেছিলেন।
              </span>
            </div>

            {/* CHANNEL SELECTOR: SMS, WhatsApp, Email */}
            <div className="channel-section">
              <label className="section-label">Select Verification Channel (কোড পাঠানোর মাধ্যম):</label>
              <div className="channel-grid">
                {/* SMS Channel */}
                <button
                  type="button"
                  className={`channel-card ${channel === "sms" ? "active" : ""}`}
                  onClick={() => setChannel("sms")}
                >
                  <div className="channel-icon sms-icon">💬</div>
                  <div className="channel-info">
                    <span className="channel-title">SMS Message</span>
                    <span className="channel-desc">মোবাইল এসএমএস</span>
                  </div>
                  {channel === "sms" && <span className="channel-check">✓</span>}
                </button>

                {/* WhatsApp Channel */}
                <button
                  type="button"
                  className={`channel-card ${channel === "whatsapp" ? "active" : ""}`}
                  onClick={() => setChannel("whatsapp")}
                >
                  <div className="channel-icon wa-icon">🟢</div>
                  <div className="channel-info">
                    <span className="channel-title">WhatsApp</span>
                    <span className="channel-desc">হোয়াটসঅ্যাপ বার্তা</span>
                  </div>
                  {channel === "whatsapp" && <span className="channel-check">✓</span>}
                </button>

                {/* Email Channel */}
                <button
                  type="button"
                  className={`channel-card ${channel === "email" ? "active" : ""}`}
                  onClick={() => setChannel("email")}
                >
                  <div className="channel-icon email-icon">📧</div>
                  <div className="channel-info">
                    <span className="channel-title">Email</span>
                    <span className="channel-desc">ইমেইল ভেরিফিকেশন</span>
                  </div>
                  {channel === "email" && <span className="channel-check">✓</span>}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !identifier.trim()}
              className="btn-primary"
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  <span>SENDING VERIFICATION CODE...</span>
                </>
              ) : (
                <>
                  <span>SEND VERIFICATION CODE</span>
                  <span className="arrow">→</span>
                </>
              )}
            </button>

            <div className="footer-links">
              <Link href="/auth/login" className="back-link">
                ← Back to Sign In (লগইন পেইজে ফিরুন)
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: VERIFICATION CODE & NEW PASSWORD */}
        {step === "VERIFY" && (
          <form onSubmit={handleConfirmReset} className="reset-form">
            {/* Destination Pill & WhatsApp Direct Link Notice */}
            <div className="verify-target-badge">
              <span className="dest-channel">
                {channel === "sms" && "💬 SMS"}
                {channel === "whatsapp" && "🟢 WhatsApp"}
                {channel === "email" && "📧 Email"}
              </span>
              <span className="dest-value">{successInfo?.destination}</span>
            </div>

            {channel === "whatsapp" && successInfo?.whatsappLink && (
              <div className="whatsapp-prompt-box">
                <p>
                  আপনার ফোনে WhatsApp অ্যাপ থাকলে নিচের বাটনে ক্লিক করে সরাসরি সাপোর্ট থেকে কোডটি পেতে পারেন:
                </p>
                <a
                  href={successInfo.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whatsapp-btn"
                >
                  <span>Open WhatsApp Directly (সরাসরি খুলুন)</span>
                  <span>↗</span>
                </a>
              </div>
            )}

            {/* OTP Code Input */}
            <div className="input-group">
              <label htmlFor="otp">
                6-Digit Verification Code <span className="req">*</span>
              </label>
              <div className="input-field-wrapper">
                <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={isLoading}
                  className="otp-input"
                  required
                />
              </div>
              <div className="resend-row">
                {canResend ? (
                  <button
                    type="button"
                    onClick={() => handleRequestOtp()}
                    disabled={isLoading}
                    className="resend-btn"
                  >
                    Resend Code (পুনরায় কোড পাঠান)
                  </button>
                ) : (
                  <span className="resend-timer">
                    Resend available in {resendTimer}s
                  </span>
                )}
              </div>
            </div>

            {/* New Password */}
            <div className="input-group">
              <label htmlFor="newPassword">
                New Password <span className="req">*</span>
              </label>
              <div className="input-field-wrapper">
                <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="eye-toggle"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <span className="helper-text">
                Password must be minimum 8 characters long.
              </span>
            </div>

            {/* Confirm New Password */}
            <div className="input-group">
              <label htmlFor="confirmPassword">
                Confirm New Password <span className="req">*</span>
              </label>
              <div className="input-field-wrapper">
                <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !otp.trim() || newPassword.length < 8}
              className="btn-primary"
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  <span>UPDATING PASSWORD...</span>
                </>
              ) : (
                <>
                  <span>CONFIRM & UPDATE PASSWORD</span>
                  <span className="arrow">✓</span>
                </>
              )}
            </button>

            <div className="footer-links">
              <button
                type="button"
                onClick={() => {
                  setStep("IDENTIFIER");
                  setErrorMessage(null);
                }}
                className="back-btn"
              >
                ← Change Number / Channel (মাধ্যম পরিবর্তন)
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === "SUCCESS" && (
          <div className="success-state">
            <div className="success-icon-wrap">
              <div className="success-circle">✓</div>
            </div>
            <h2>Password Changed Successfully!</h2>
            <p>
              আপনার পাসওয়ার্ড পরিবর্তন সফল হয়েছে। এখন নতুন পাসওয়ার্ড দিয়ে আপনার অ্যাকাউন্টে লগইন করতে পারবেন।
            </p>
            <div className="countdown-pill">
              Redirecting to Sign In in {redirectCountdown}s...
            </div>
            <Link href="/auth/login" className="btn-primary success-btn">
              PROCEED TO SIGN IN NOW →
            </Link>
          </div>
        )}
      </div>

      <style jsx>{`
        .reset-container {
          min-height: 100vh;
          background-color: #f7f9f6;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .reset-card {
          width: 100%;
          max-width: 520px;
          background: #ffffff;
          border-radius: 24px;
          padding: 40px 36px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03);
          border: 1px solid #edf1eb;
        }

        .brand-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f0f3ee;
        }

        .logo-link {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .logo-badge {
          width: 36px;
          height: 36px;
          background-color: #16a34a;
          color: #ffffff;
          font-weight: 800;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }

        .logo-text {
          font-size: 20px;
          font-weight: 800;
          color: #151515;
          letter-spacing: -0.5px;
        }

        .security-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: #16a34a;
          background: #f0fdf4;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid #bbf7d0;
        }

        .tag-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #16a34a;
        }

        .card-heading {
          margin-bottom: 24px;
        }

        .card-heading h1 {
          font-size: 24px;
          font-weight: 800;
          color: #151515;
          margin: 0 0 6px 0;
          letter-spacing: -0.5px;
        }

        .card-heading p {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
          line-height: 1.5;
        }

        .alert-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.4;
          margin-bottom: 20px;
        }

        .alert-box.error {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .alert-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .reset-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-group label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .req {
          color: #dc2626;
        }

        .input-field-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-icon {
          position: absolute;
          left: 14px;
          width: 18px;
          height: 18px;
          color: #9ca3af;
          pointer-events: none;
        }

        .input-field-wrapper input {
          width: 100%;
          height: 48px;
          padding: 0 14px 0 42px;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          font-size: 14px;
          color: #111827;
          background: #fdfdfd;
          transition: all 0.2s ease;
          outline: none;
        }

        .input-field-wrapper input:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
          background: #ffffff;
        }

        .otp-input {
          letter-spacing: 4px;
          font-weight: 700;
          font-size: 18px !important;
        }

        .eye-toggle {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 6px;
        }

        .helper-text {
          font-size: 12px;
          color: #6b7280;
        }

        /* Channel Selector Grid */
        .channel-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .section-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .channel-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .channel-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
          padding: 14px 8px;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          background: #fafbfa;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .channel-card:hover {
          background: #f3f5f2;
          border-color: #cbd5e1;
        }

        .channel-card.active {
          border-color: #16a34a;
          background: #f0fdf4;
          box-shadow: 0 2px 8px rgba(22, 163, 74, 0.12);
        }

        .channel-icon {
          font-size: 22px;
          line-height: 1;
        }

        .channel-title {
          font-size: 12px;
          font-weight: 700;
          color: #151515;
          display: block;
        }

        .channel-desc {
          font-size: 10px;
          color: #64748b;
          display: block;
        }

        .channel-check {
          position: absolute;
          top: 6px;
          right: 8px;
          font-size: 11px;
          font-weight: 800;
          color: #16a34a;
        }

        .verify-target-badge {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
        }

        .dest-channel {
          font-weight: 700;
          color: #0f172a;
        }

        .dest-value {
          font-family: monospace;
          color: #475569;
          font-weight: 600;
        }

        .whatsapp-prompt-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .whatsapp-prompt-box p {
          font-size: 12px;
          color: #166534;
          margin: 0;
          line-height: 1.4;
        }

        .whatsapp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #25d366;
          color: #ffffff;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: background 0.15s ease;
        }

        .whatsapp-btn:hover {
          background: #20ba5a;
        }

        .resend-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 4px;
        }

        .resend-btn {
          background: none;
          border: none;
          color: #16a34a;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        }

        .resend-timer {
          font-size: 12px;
          color: #9ca3af;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 48px;
          background: #151515;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          margin-top: 6px;
        }

        .btn-primary:hover:not(:disabled) {
          background: #000000;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .arrow {
          font-size: 16px;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .footer-links {
          display: flex;
          justify-content: center;
          margin-top: 4px;
        }

        .back-link,
        .back-btn {
          font-size: 13px;
          color: #6b7280;
          text-decoration: none;
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 500;
          transition: color 0.15s ease;
        }

        .back-link:hover,
        .back-btn:hover {
          color: #151515;
        }

        /* SUCCESS STATE */
        .success-state {
          text-align: center;
          padding: 20px 0 10px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .success-icon-wrap {
          margin-bottom: 4px;
        }

        .success-circle {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          background: #f0fdf4;
          color: #16a34a;
          border: 2px solid #86efac;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 800;
        }

        .success-state h2 {
          font-size: 22px;
          font-weight: 800;
          color: #151515;
          margin: 0;
        }

        .success-state p {
          font-size: 14px;
          color: #4b5563;
          margin: 0;
          max-width: 380px;
          line-height: 1.5;
        }

        .countdown-pill {
          background: #f3f4f6;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 999px;
        }

        .success-btn {
          margin-top: 10px;
        }

        @media (max-width: 500px) {
          .reset-card {
            padding: 28px 20px;
          }

          .channel-grid {
            grid-template-columns: 1fr;
          }

          .channel-card {
            flex-direction: row;
            padding: 10px 14px;
            text-align: left;
          }

          .channel-info {
            flex: 1;
            margin-left: 8px;
          }
        }
      `}</style>
    </div>
  );
}

