"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

// Vector Illustration matching the mockup (Office worker at desk with computer & lush plants)
function LoginIllustration() {
  return (
    <svg
      viewBox="0 0 540 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="banner-illustration-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0066f5" />
          <stop offset="60%" stopColor="#0052cc" />
          <stop offset="100%" stopColor="#003d99" />
        </linearGradient>
        <linearGradient id="accentCurve" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.1" />
        </linearGradient>
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#001a4d" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Dynamic Cobalt Wave Background */}
      <path
        d="M-40 -40 H400 C430 140 500 240 450 360 C400 480 320 540 300 640 H-40 Z"
        fill="url(#waveGrad)"
      />
      <path
        d="M-40 80 C180 120 340 260 380 440 C400 530 320 620 280 660 H-40 Z"
        fill="url(#accentCurve)"
      />

      {/* Ambient Floor Shadow */}
      <ellipse cx="280" cy="510" rx="190" ry="24" fill="#002266" fillOpacity="0.25" />

      {/* Left Potted Plant */}
      <g id="leftPlant">
        <polygon points="60,420 105,420 95,500 70,500" fill="#1e293b" />
        <ellipse cx="82.5" cy="420" rx="22.5" ry="6" fill="#334155" />
        {/* Large Plant Leaves */}
        <path d="M80 420 C60 360 20 340 10 370 C20 400 65 420 80 420Z" fill="#15803d" />
        <path d="M82 420 C80 340 45 300 30 320 C35 360 70 410 82 420Z" fill="#22c55e" />
        <path d="M85 420 C95 330 80 270 65 285 C60 330 75 400 85 420Z" fill="#16a34a" />
        <path d="M85 420 C110 340 135 310 145 335 C135 375 100 415 85 420Z" fill="#4ade80" />
      </g>

      {/* Office Desk */}
      <g id="deskGroup">
        <rect x="180" y="380" width="220" height="14" rx="4" fill="#475569" filter="url(#softShadow)" />
        <rect x="330" y="394" width="70" height="106" rx="4" fill="#334155" />
        <rect x="335" y="405" width="60" height="26" rx="2" fill="#1e293b" />
        <circle cx="365" cy="418" r="3" fill="#94a3b8" />
        <rect x="335" y="438" width="60" height="26" rx="2" fill="#1e293b" />
        <circle cx="365" cy="451" r="3" fill="#94a3b8" />
        <rect x="195" y="394" width="10" height="106" rx="3" fill="#334155" />
      </g>

      {/* Modern Desktop Monitor on Desk */}
      <g id="computerMonitor">
        <rect x="290" y="275" width="115" height="85" rx="6" fill="#0f172a" />
        <rect x="296" y="281" width="103" height="73" rx="4" fill="#1e293b" />
        <rect x="304" y="290" width="45" height="6" rx="2" fill="#38bdf8" />
        <rect x="304" y="302" width="75" height="4" rx="2" fill="#64748b" />
        <rect x="304" y="311" width="60" height="4" rx="2" fill="#64748b" />
        <rect x="304" y="320" width="50" height="4" rx="2" fill="#10b981" />
        <rect x="342" y="360" width="10" height="20" fill="#64748b" />
        <ellipse cx="347" cy="380" rx="20" ry="4" fill="#475569" />
      </g>

      {/* Ergonomic Office Chair */}
      <g id="officeChair">
        <path d="M190 280 C180 280 175 320 180 390 C185 415 210 425 225 425 Z" fill="#0f172a" />
        <rect x="185" y="415" width="70" height="16" rx="8" fill="#1e293b" />
        <rect x="215" y="431" width="8" height="65" fill="#64748b" />
        <path d="M219 490 L185 506" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
        <path d="M219 490 L250 506" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
        <circle cx="185" cy="508" r="5" fill="#0f172a" />
        <circle cx="250" cy="508" r="5" fill="#0f172a" />
      </g>

      {/* Worker Character Sitting */}
      <g id="workerSitting">
        <path d="M220 420 C240 440 255 460 255 500 L240 505 C230 465 215 445 205 425 Z" fill="#1d4ed8" />
        <ellipse cx="250" cy="506" rx="14" ry="7" fill="#0f172a" />
        <path d="M225 420 C250 435 285 450 310 520 L290 525 C270 465 240 445 215 425 Z" fill="#2563eb" />
        <ellipse cx="305" cy="525" rx="16" ry="8" fill="#0f172a" />

        <path d="M205 315 C220 315 245 330 248 420 L205 420 C195 380 195 335 205 315 Z" fill="#ffffff" />
        <polygon points="228,325 233,325 235,390 230,400 226,390" fill="#10b981" />

        <rect x="250" y="360" width="16" height="18" rx="3" fill="#ef4444" />
        <path d="M266 364 C271 364 271 374 266 374" stroke="#ef4444" strokeWidth="2.5" fill="none" />
        <path d="M255 354 Q253 348 256 342" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M260 355 Q262 349 259 344" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />

        <path d="M235 335 C248 345 255 355 252 368" stroke="#ffffff" strokeWidth="16" strokeLinecap="round" />
        <circle cx="253" cy="370" r="7" fill="#fed7aa" />

        <rect x="220" y="295" width="14" height="24" rx="6" fill="#fed7aa" />
        <circle cx="228" cy="285" r="18" fill="#fed7aa" />
        <path d="M212 284 C210 265 225 255 240 258 C250 260 252 272 248 282 C242 272 232 270 220 274 Z" fill="#0f172a" />
      </g>

      {/* Right Foliage Plants */}
      <g id="rightFoliage">
        <polygon points="380,480 405,480 400,525 385,525" fill="#0f172a" />
        <ellipse cx="392.5" cy="480" rx="12.5" ry="4" fill="#334155" />
        <path d="M392 480 C390 410 420 370 445 380 C440 420 410 460 392 480Z" fill="#0284c7" />
        <path d="M394 480 C410 420 445 420 455 440 C445 470 415 480 394 480Z" fill="#10b981" />
        <path d="M390 480 C370 430 350 410 340 430 C348 460 375 475 390 480Z" fill="#22c55e" />
      </g>
    </svg>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "";

  const { smartLogin, loginWithGoogle, sendCustomerOtp, verifyCustomerOtp, isAuthenticated, user, logout } = useAuth();

  // Primary Login State with LocalStorage Remember Me automation
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockActive, setCapsLockActive] = useState(false);

  // 2FA TOTP State (Triggers for staff accounts requiring TOTP)
  const [requires2Fa, setRequires2Fa] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  // Customer SMS OTP Alternative State
  const [useOtpMode, setUseOtpMode] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpStep, setOtpStep] = useState<"PHONE" | "VERIFY">("PHONE");
  const [customerOtp, setCustomerOtp] = useState("");

  // System & Loading State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; client_id: string } | null>(null);

  const identifierInputRef = useRef<HTMLInputElement>(null);

  // Load saved remember me identifier on mount & fetch Google OAuth config
  useEffect(() => {
    let isMounted = true;
    try {
      const savedUser = localStorage.getItem("nca_remembered_identifier");
      if (savedUser) {
        setIdentifier(savedUser);
      }
    } catch {
      // LocalStorage access safe guard
    }

    fetch("/api/v1/auth/google/config")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          setGoogleConfig({
            enabled: Boolean(data.enabled),
            client_id: data.client_id || "",
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle keyboard CapsLock detection
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  // Perform immediate safe redirection
  const performRedirect = (isStaffMember: boolean) => {
    setIsSuccess(true);
    // User requested: If staff member -> /admin, if regular user -> "/" (or redirectParam if provided)
    const targetUrl = redirectParam || (isStaffMember ? "/admin" : "/");
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 300);
  };

  // Handle Smart Unified Login
  const handleSmartLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage("Please enter your Username, Email, or Mobile Phone.");
      identifierInputRef.current?.focus();
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Remember me automation
      if (typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem("nca_remembered_identifier", cleanIdentifier);
        } else {
          localStorage.removeItem("nca_remembered_identifier");
        }
      }

      const res = await smartLogin(cleanIdentifier, password, requires2Fa ? totpCode.trim() : undefined);

      if (res.requiresTotp) {
        setRequires2Fa(true);
        setIsSubmitting(false);
        return;
      }

      performRedirect(Boolean(res.isStaff));
    } catch (err: unknown) {
      setIsSubmitting(false);
      const raw = err instanceof Error ? err.message : "";
      if (
        raw.toLowerCase().includes("invalid") ||
        raw.toLowerCase().includes("credential") ||
        raw.toLowerCase().includes("password") ||
        raw.toLowerCase().includes("user") ||
        raw.toLowerCase().includes("not found") ||
        raw.toLowerCase().includes("401")
      ) {
        setErrorMessage("Invalid username, email, or password. Please check your credentials and try again.");
      } else {
        setErrorMessage(raw || "Authentication failed. Invalid username or password.");
      }
    }
  };

  // Handle Google Sign-In
  const handleGoogleClick = async () => {
    setErrorMessage(null);

    if (!googleConfig?.enabled || !googleConfig?.client_id) {
      setErrorMessage("Google Sign-In is not configured yet. Configure Client ID in Admin Settings -> Google Sign-In.");
      return;
    }

    setIsSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (win.google && win.google.accounts) {
        win.google.accounts.id.initialize({
          client_id: googleConfig.client_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: async (response: any) => {
            if (response?.credential) {
              const res = await loginWithGoogle(response.credential);
              if (res.requiresTotp) {
                setRequires2Fa(true);
                setIsSubmitting(false);
                return;
              }
              performRedirect(Boolean(res.isStaff));
            }
          },
        });
        win.google.accounts.id.prompt();
      } else {
        setErrorMessage("Google Identity Services are loading. Please try again in a moment.");
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : "Google authentication failed.");
    }
  };

  // Customer Mobile OTP Fallback
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleaned = phone.replace(/\s+/g, "");
    if (cleaned.length < 10) {
      setErrorMessage("Please enter a valid Bangladesh phone number (e.g. 01712345678).");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await sendCustomerOtp(cleaned);
      setOtpStep("VERIFY");
      if (res.demoOtp) {
        setCustomerOtp(res.demoOtp);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to dispatch verification OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (customerOtp.trim().length !== 6) {
      setErrorMessage("Please enter the full 6-digit verification code.");
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyCustomerOtp(phone.replace(/\s+/g, ""), customerOtp.trim());
      performRedirect(false);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : "Invalid or expired OTP code.");
    }
  };

  return (
    <div className="login-root-container">
      {/* Background Accent Lines */}
      <div className="bg-canvas-accents" aria-hidden="true">
        <svg className="accent-doodle-svg" viewBox="0 0 1200 800" fill="none">
          <path
            d="M 50,150 Q 250,50 450,150 T 850,200"
            stroke="#22c55e"
            strokeWidth="3.5"
            strokeDasharray="14 14"
          />
          <path
            d="M 100,500 Q 400,600 700,450 T 1150,600"
            stroke="#0066f5"
            strokeWidth="3.5"
            strokeDasharray="18 18"
          />
        </svg>
      </div>

      {/* Main Responsive Card */}
      <div className="login-main-card">
        {/* Left Column (Top on mobile): Blue Wave with Modern Vector Illustration */}
        <div className="login-illustration-pane">
          <div className="illustration-wrapper">
            <LoginIllustration />
          </div>

          <div className="illustration-caption">
            <span className="caption-brand">Nawabpur Complex Accessories</span>
            <span className="caption-pill">Enterprise Trade & Backoffice</span>
          </div>
        </div>

        {/* Right Column (Bottom on mobile): Clean Crisp White Form Card */}
        <div className="login-form-pane">
          {/* Brand Logo & Header */}
          <div className="brand-header-area">
            <Link href="/" className="brand-logo-link">
              <div className="brand-logo-icon">N</div>
              <div className="brand-logo-texts">
                <span className="brand-title">
                  ncamart<span className="brand-dot">.</span>
                </span>
                <span className="brand-tagline">Nawabpur Complex</span>
              </div>
            </Link>

            <h1 className="form-heading">
              {requires2Fa ? "Security Verification" : "Sign in to your account"}
            </h1>
            <p className="form-subheading">
              {requires2Fa
                ? "Enter your 6-digit Google Authenticator code"
                : "Sign in to access your dashboard, orders & wholesale prices"}
            </p>
          </div>

          {/* Active Session Notification */}
          {isAuthenticated && user && !requires2Fa && (
            <div className="active-session-banner">
              <div className="session-user-info">
                <strong>Signed in as:</strong> {user.name || user.email || user.phone}
                <span className="role-tag">
                  {user.isStaff ? "Staff / Backoffice" : "Customer"}
                </span>
              </div>
              <div className="session-actions">
                <button
                  type="button"
                  onClick={() => performRedirect(Boolean(user.isStaff))}
                  className="btn-continue"
                >
                  {user.isStaff ? "Direct to Admin →" : "Continue Shopping →"}
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="btn-signout"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Success Redirecting Banner */}
          {isSuccess && (
            <div className="success-alert-banner" role="status">
              <span className="success-spinner"></span>
              <span>
                Authenticated successfully! Redirecting to {user?.isStaff ? "Admin..." : "Storefront..."}
              </span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="error-alert-banner" role="alert">
              <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* CapsLock Warning */}
          {capsLockActive && !requires2Fa && (
            <div className="capslock-warning">
              ⚠️ Caps Lock is ON
            </div>
          )}

          {/* ===================== MODE 1: 2FA TOTP VERIFICATION ===================== */}
          {requires2Fa ? (
            <form onSubmit={handleSmartLogin} className="form-wrapper">
              <div className="totp-info-box">
                <div className="totp-shield-badge">🛡️</div>
                <div className="totp-info-text">
                  <div className="totp-title">2FA Enabled on Staff Account</div>
                  <div className="totp-desc">
                    Open Google Authenticator on your phone and enter the active 6-digit verification code.
                  </div>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="totpCodeInput">
                  6-Digit Authenticator Code
                </label>
                <input
                  id="totpCodeInput"
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={totpCode}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setTotpCode(e.target.value.replace(/\D/g, ""));
                  }}
                  placeholder="000 000"
                  className="totp-large-input"
                  autoFocus
                  required
                />
              </div>

              <div className="button-group">
                <button
                  type="submit"
                  disabled={isSubmitting || totpCode.trim().length !== 6}
                  className="btn-pill-submit"
                >
                  <span className="btn-circle-arrow">→</span>
                  <span>{isSubmitting ? "Verifying..." : "Verify & Access Admin"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRequires2Fa(false);
                    setTotpCode("");
                    setErrorMessage(null);
                  }}
                  className="btn-link-back"
                >
                  ← Back to Login Credentials
                </button>
              </div>
            </form>
          ) : useOtpMode ? (
            /* ===================== MODE 2: CUSTOMER SMS OTP ===================== */
            otpStep === "PHONE" ? (
              <form onSubmit={handleSendOtp} className="form-wrapper">
                <div className="field-group">
                  <label className="field-label" htmlFor="phoneInput">
                    Mobile Phone Number (Bangladesh)
                  </label>
                  <div className="field-input-wrap">
                    <span className="phone-prefix">🇧🇩 +88</span>
                    <input
                      id="phoneInput"
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setErrorMessage(null);
                        setPhone(e.target.value);
                      }}
                      placeholder="01712 345678"
                      className="clean-text-input prefix-padded"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-pill-submit"
                >
                  <span className="btn-circle-arrow">→</span>
                  <span>{isSubmitting ? "Sending..." : "Send Verification SMS"}</span>
                </button>

                <div className="center-link-box">
                  <button
                    type="button"
                    onClick={() => {
                      setUseOtpMode(false);
                      setErrorMessage(null);
                    }}
                    className="btn-text-link"
                  >
                    ← Sign in with Password / Username instead
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="form-wrapper">
                <div className="field-group">
                  <label className="field-label" htmlFor="otpCodeInput">
                    Enter 6-Digit OTP sent to {phone}
                  </label>
                  <input
                    id="otpCodeInput"
                    type="text"
                    maxLength={6}
                    value={customerOtp}
                    onChange={(e) => {
                      setErrorMessage(null);
                      setCustomerOtp(e.target.value.replace(/\D/g, ""));
                    }}
                    placeholder="000000"
                    className="totp-large-input"
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || customerOtp.trim().length !== 6}
                  className="btn-pill-submit"
                >
                  <span className="btn-circle-arrow">→</span>
                  <span>{isSubmitting ? "Verifying..." : "Verify OTP & Sign In"}</span>
                </button>

                <div className="otp-actions-row">
                  <button type="button" onClick={() => setOtpStep("PHONE")} className="btn-subtle">
                    Change Number
                  </button>
                  <button type="button" onClick={() => setUseOtpMode(false)} className="btn-text-link">
                    Use Password
                  </button>
                </div>
              </form>
            )
          ) : (
            /* ===================== MODE 3: DEFAULT SMART LOGIN ===================== */
            <form onSubmit={handleSmartLogin} className="form-wrapper">
              {/* Email / Username / Phone Input */}
              <div className="field-group">
                <label className="field-label" htmlFor="userIdentifier">
                  Email, Username, or Phone
                </label>
                <div className="field-input-wrap">
                  <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input
                    id="userIdentifier"
                    ref={identifierInputRef}
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setErrorMessage(null);
                      setIdentifier(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="name@example.com or admin"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    required
                    className="clean-text-input"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="field-group">
                <label className="field-label" htmlFor="userPassword">
                  Password
                </label>
                <div className="field-input-wrap">
                  <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    id="userPassword"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setErrorMessage(null);
                      setPassword(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="clean-text-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="eye-toggle-btn"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="eye-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="eye-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password Row */}
              <div className="options-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="custom-checkbox"
                  />
                  <span>Remember me</span>
                </label>

                <Link
                  href="/account/reset-password"
                  className="forgot-link"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Primary Action Button: Pill with Green Circle Arrow */}
              <div className="submit-row">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-pill-submit"
                >
                  <span className="btn-circle-arrow">→</span>
                  <span>{isSubmitting ? "SIGNING IN..." : "SIGN IN"}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="or-divider">
                <span>OR</span>
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isSubmitting}
                className="btn-google-auth"
              >
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.09C3.26 21.36 7.36 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32 0-.83.13-1.6.38-2.32V6.59H1.26C.46 8.18 0 10.03 0 12s.46 3.82 1.26 5.41l4.02-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.26 6.59l4.02 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Customer Mobile SMS OTP Alternative Link */}
              <div className="otp-toggle-row">
                <button
                  type="button"
                  onClick={() => {
                    setUseOtpMode(true);
                    setErrorMessage(null);
                  }}
                  className="btn-otp-toggle"
                >
                  📱 Sign in with Bangladesh Mobile SMS OTP instead
                </button>
              </div>

              {/* Create Account Link */}
              <div className="signup-footer-box">
                <Link href="/register" className="btn-signup-link">
                  Don&apos;t have an account? Create an account
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer copyright */}
      <footer className="login-footer">
        <span>© {new Date().getFullYear()} NCAMart • Nawabpur Complex</span>
        <span className="dot-sep">•</span>
        <Link href="/" className="footer-link">Storefront Home</Link>
        <span className="dot-sep">•</span>
        <Link href="/admin" className="footer-link">Admin Backoffice</Link>
      </footer>

      {/* Explicit Dedicated Scoped CSS */}
      <style jsx>{`
        .login-root-container {
          min-height: 100vh;
          width: 100vw;
          max-width: 100%;
          background-color: #16181d;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          overflow-x: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          box-sizing: border-box;
        }

        .bg-canvas-accents {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.2;
          overflow: hidden;
        }

        .accent-doodle-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* Main Login Card */
        .login-main-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 960px;
          min-height: 520px;
          background: #ffffff;
          border-radius: 36px;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08);
          overflow: hidden;
          display: flex;
          flex-direction: row;
        }

        /* Left Side: Modern Blue Wave & Graphic */
        .login-illustration-pane {
          flex: 1.1;
          background: linear-gradient(135deg, #0066f5 0%, #0050d0 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 32px;
          overflow: hidden;
        }

        .illustration-wrapper {
          width: 100%;
          max-width: 440px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .banner-illustration-svg {
          width: 100%;
          height: auto;
          max-height: 480px;
          display: block;
          filter: drop-shadow(0 14px 20px rgba(0, 20, 60, 0.35));
        }

        .illustration-caption {
          position: absolute;
          bottom: 16px;
          left: 24px;
          right: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.85);
          letter-spacing: 0.02em;
        }

        .caption-brand {
          font-weight: 700;
          color: #ffffff;
        }

        .caption-pill {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          padding: 3px 10px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 10px;
        }

        /* Right Side: Clean White Login Form */
        .login-form-pane {
          flex: 0.9;
          background: #ffffff;
          padding: 44px 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          color: #1e293b;
        }

        /* Brand Logo & Header */
        .brand-header-area {
          margin-bottom: 24px;
        }

        .brand-logo-link {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .brand-logo-icon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: #0066f5;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 20px;
          box-shadow: 0 4px 10px rgba(0, 102, 245, 0.3);
        }

        .brand-logo-texts {
          display: flex;
          flex-direction: column;
        }

        .brand-title {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #0f172a;
          line-height: 1;
        }

        .brand-dot {
          color: #0066f5;
        }

        .brand-tagline {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-top: 3px;
        }

        .form-heading {
          font-size: 22px;
          font-weight: 800;
          color: #1e293b;
          margin-top: 18px;
          margin-bottom: 4px;
          letter-spacing: -0.01em;
        }

        .form-subheading {
          font-size: 13px;
          color: #64748b;
          line-height: 1.4;
        }

        /* Active Session Alert */
        .active-session-banner {
          margin-bottom: 20px;
          padding: 12px 14px;
          border-radius: 14px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
        }

        .session-user-info {
          color: #065f46;
        }

        .role-tag {
          margin-left: 6px;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 999px;
          background: #d1fae5;
          color: #047857;
        }

        .session-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-continue {
          padding: 6px 12px;
          border-radius: 8px;
          background: #0066f5;
          color: #ffffff;
          font-weight: 700;
          font-size: 11px;
          border: none;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-continue:hover {
          background: #0050d0;
        }

        .btn-signout {
          background: none;
          border: none;
          color: #64748b;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-signout:hover {
          color: #e11d48;
        }

        /* Success Redirect Alert */
        .success-alert-banner {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 12px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .success-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #16a34a;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Error Alert */
        .error-alert-banner {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .error-icon {
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;
          color: #ef4444;
          display: block;
        }

        .capslock-warning {
          font-size: 11px;
          font-weight: 700;
          color: #d97706;
          margin-bottom: 10px;
        }

        /* Form Controls */
        .form-wrapper {
          display: flex;
          flex-direction: column;
        }

        .field-group {
          margin-bottom: 18px;
        }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 4px;
        }

        .field-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          border-bottom: 1.5px solid #cbd5e1;
          transition: border-color 0.2s ease;
          padding-bottom: 4px;
        }

        .field-input-wrap:focus-within {
          border-bottom-color: #0066f5;
        }

        .field-icon {
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;
          max-width: 18px !important;
          color: #94a3b8;
          margin-right: 8px;
          display: block;
        }

        .clean-text-input {
          flex: 1;
          width: 100%;
          border: none;
          background: transparent;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          padding: 8px 0;
          font-weight: 500;
        }

        .clean-text-input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        .eye-toggle-btn {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .eye-toggle-btn:hover {
          color: #475569;
        }

        .eye-icon {
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;
          display: block;
        }

        .prefix-padded {
          padding-left: 6px;
        }

        .phone-prefix {
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          margin-right: 6px;
        }

        /* Options Row: Remember Me & Forgot */
        .options-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
          margin-bottom: 22px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          user-select: none;
        }

        .custom-checkbox {
          width: 15px;
          height: 15px;
          accent-color: #0066f5;
          cursor: pointer;
        }

        .forgot-link {
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .forgot-link:hover {
          color: #0066f5;
        }

        /* Pill Action Button matching the Mockup */
        .submit-row {
          margin-top: 4px;
        }

        .btn-pill-submit {
          width: 100%;
          height: 48px;
          border-radius: 999px;
          background: #0066f5;
          color: #ffffff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 10px 22px -6px rgba(0, 102, 245, 0.45);
          transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }

        .btn-pill-submit:hover:not(:disabled) {
          background: #0056d6;
          box-shadow: 0 14px 28px -6px rgba(0, 102, 245, 0.55);
        }

        .btn-pill-submit:active:not(:disabled) {
          transform: scale(0.99);
        }

        .btn-pill-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-circle-arrow {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #22c55e;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 900;
          box-shadow: inset 0 -1px 2px rgba(0, 0, 0, 0.2);
        }

        /* Divider */
        .or-divider {
          position: relative;
          text-align: center;
          margin: 18px 0;
        }

        .or-divider::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: #e2e8f0;
        }

        .or-divider span {
          position: relative;
          background: #ffffff;
          padding: 0 12px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        /* Google Button */
        .btn-google-auth {
          width: 100%;
          height: 44px;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .btn-google-auth:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .google-icon {
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;
          display: block;
        }

        /* Customer OTP / Alternate Links */
        .otp-toggle-row {
          margin-top: 12px;
          text-align: center;
        }

        .btn-otp-toggle {
          background: none;
          border: none;
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .btn-otp-toggle:hover {
          color: #0066f5;
        }

        .signup-footer-box {
          margin-top: 14px;
          text-align: center;
        }

        .btn-signup-link {
          font-size: 12px;
          font-weight: 700;
          color: #0066f5;
          text-decoration: none;
        }

        .btn-signup-link:hover {
          text-decoration: underline;
        }

        /* 2FA Authenticator UI */
        .totp-info-box {
          padding: 12px 14px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }

        .totp-shield-badge {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .totp-title {
          font-size: 12px;
          font-weight: 700;
          color: #1e3a8a;
        }

        .totp-desc {
          font-size: 11px;
          color: #3b82f6;
          margin-top: 2px;
          line-height: 1.3;
        }

        .totp-large-input {
          width: 100%;
          text-align: center;
          letter-spacing: 0.35em;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 24px;
          font-weight: 900;
          padding: 12px 14px;
          background: #f8fafc;
          border: 2px solid #93c5fd;
          border-radius: 14px;
          outline: none;
          color: #0f172a;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }

        .totp-large-input:focus {
          border-color: #0066f5;
        }

        .button-group {
          margin-top: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .btn-link-back {
          background: none;
          border: none;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          padding: 6px;
        }

        .btn-link-back:hover {
          color: #1e293b;
        }

        .center-link-box {
          margin-top: 14px;
          text-align: center;
        }

        .btn-text-link {
          background: none;
          border: none;
          color: #0066f5;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-text-link:hover {
          text-decoration: underline;
        }

        .otp-actions-row {
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
        }

        .btn-subtle {
          background: none;
          border: none;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-subtle:hover {
          color: #0f172a;
        }

        /* Footer */
        .login-footer {
          margin-top: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 12px;
          color: #64748b;
        }

        .dot-sep {
          color: #475569;
        }

        .footer-link {
          color: #94a3b8;
          text-decoration: none;
        }

        .footer-link:hover {
          color: #ffffff;
        }

        /* Responsive Breakpoint: Mobile Screen */
        @media (max-width: 860px) {
          .login-main-card {
            flex-direction: column;
            border-radius: 28px;
            max-width: 440px;
          }

          .login-illustration-pane {
            min-height: 240px;
            padding: 20px;
          }

          .banner-illustration-svg {
            max-height: 200px;
          }

          .illustration-caption {
            display: none;
          }

          .login-form-pane {
            padding: 32px 24px;
          }

          .brand-header-area {
            margin-bottom: 20px;
          }

          .form-heading {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", backgroundColor: "#16181d", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}>
          <div>Loading Login Portal...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
