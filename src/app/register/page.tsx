"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

// Vector Illustration for Registration (Shopping & Wholesale fulfillment)
function RegisterIllustration() {
  return (
    <svg
      viewBox="0 0 540 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="banner-illustration-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="regWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0066f5" />
          <stop offset="60%" stopColor="#0052cc" />
          <stop offset="100%" stopColor="#003d99" />
        </linearGradient>
        <linearGradient id="regAccentCurve" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Dynamic Cobalt Wave Background */}
      <path
        d="M-40 -40 H400 C430 140 500 240 450 360 C400 480 320 540 300 640 H-40 Z"
        fill="url(#regWaveGrad)"
      />
      <path
        d="M-40 80 C180 120 340 260 380 440 C400 530 320 620 280 660 H-40 Z"
        fill="url(#regAccentCurve)"
      />

      {/* Floor Shadow */}
      <ellipse cx="270" cy="520" rx="180" ry="22" fill="#002266" fillOpacity="0.25" />

      {/* Decorative Potted Plant */}
      <g id="regPlant">
        <polygon points="60,430 100,430 92,500 68,500" fill="#1e293b" />
        <ellipse cx="80" cy="430" rx="20" ry="5" fill="#334155" />
        <path d="M78 430 C60 370 25 350 15 380 C25 410 65 430 78 430Z" fill="#15803d" />
        <path d="M80 430 C78 350 48 310 35 330 C40 370 70 420 80 430Z" fill="#22c55e" />
        <path d="M82 430 C92 340 78 280 65 295 C60 340 75 410 82 430Z" fill="#16a34a" />
        <path d="M82 430 C105 350 128 320 138 345 C128 385 96 425 82 430Z" fill="#4ade80" />
      </g>

      {/* Wholesale Delivery Box Package */}
      <g id="deliveryBox">
        <rect x="310" y="420" width="90" height="75" rx="6" fill="#d97706" />
        <rect x="310" y="415" width="90" height="15" rx="3" fill="#b45309" />
        {/* Packing tape */}
        <rect x="345" y="415" width="20" height="80" fill="#fde68a" fillOpacity="0.85" />
        <polygon points="340,430 370,430 365,445 345,445" fill="#78350f" fillOpacity="0.3" />
        {/* Fragile / Verified stamp */}
        <rect x="320" y="450" width="22" height="16" rx="2" fill="#ef4444" />
        <path d="M325 458 L329 462 L337 454" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Customer / Merchant Character with Tablet */}
      <g id="customerMerchant">
        {/* Character Legs */}
        <path d="M220 400 L210 520 L235 520 L240 400 Z" fill="#1d4ed8" />
        <path d="M245 400 L255 520 L280 520 L265 400 Z" fill="#2563eb" />
        {/* Shoes */}
        <ellipse cx="222" cy="522" rx="16" ry="7" fill="#0f172a" />
        <ellipse cx="268" cy="522" rx="16" ry="7" fill="#0f172a" />

        {/* Torso / Modern Jacket */}
        <rect x="205" y="280" width="65" height="125" rx="12" fill="#ffffff" />
        <path d="M205 285 L237 360 L270 285 Z" fill="#0284c7" fillOpacity="0.15" />
        <polygon points="233,290 241,290 244,350 237,358 231,350" fill="#10b981" />

        {/* Head & Hair */}
        <rect x="228" y="255" width="18" height="25" rx="8" fill="#fed7aa" />
        <circle cx="237" cy="245" r="22" fill="#fed7aa" />
        <path d="M218 245 C215 220 235 210 252 215 C265 218 268 232 262 244 C255 232 242 230 228 234 Z" fill="#0f172a" />

        {/* Tablet in Hand */}
        <rect x="250" y="325" width="60" height="42" rx="4" fill="#0f172a" />
        <rect x="254" y="329" width="52" height="34" rx="2" fill="#38bdf8" />
        <rect x="258" y="335" width="30" height="4" rx="1" fill="#ffffff" />
        <rect x="258" y="343" width="44" height="3" rx="1" fill="#ffffff" fillOpacity="0.8" />
        <rect x="258" y="349" width="22" height="3" rx="1" fill="#10b981" />
        {/* Hand holding tablet */}
        <circle cx="254" cy="355" r="7" fill="#fed7aa" />
        <circle cx="295" cy="355" r="7" fill="#fed7aa" />
      </g>

      {/* Floating Success Shield / Badge */}
      <g id="verifiedBadge">
        <circle cx="380" cy="240" r="30" fill="#22c55e" filter="drop-shadow(0 8px 16px rgba(34, 197, 94, 0.4))" />
        <path d="M368 240 L376 248 L392 232" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="345" y="280" width="70" height="16" rx="8" fill="#ffffff" />
        <text x="380" y="291" fill="#0f172a" fontSize="8" fontWeight="800" textAnchor="middle">
          GENUINE NCA
        </text>
      </g>
    </svg>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "";

  const { registerCustomer, isAuthenticated, user, logout } = useAuth();

  // Registration Form State
  const [accountType, setAccountType] = useState<"RETAIL" | "WHOLESALE">("RETAIL");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Status & Feedback States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; client_id: string } | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Password Strength Meter
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "#cbd5e1" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[a-zA-Z]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score: 1, label: "Weak (add letters/numbers)", color: "#ef4444" };
    if (score <= 3) return { score: 2, label: "Good password", color: "#f59e0b" };
    return { score: 3, label: "Strong & secure password", color: "#10b981" };
  };

  const strength = getPasswordStrength(password);

  // Preconnect to Google accounts for zero-latency network connection & fetch settings
  useEffect(() => {
    let isMounted = true;

    if (typeof document !== "undefined") {
      const link1 = document.createElement("link");
      link1.rel = "preconnect";
      link1.href = "https://accounts.google.com";
      document.head.appendChild(link1);

      const link2 = document.createElement("link");
      link2.rel = "dns-prefetch";
      link2.href = "https://accounts.google.com";
      document.head.appendChild(link2);
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

  // Handle Registration Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = fullName.trim();
    if (cleanName.length < 2) {
      setErrorMessage("Please enter your full name (minimum 2 characters).");
      nameInputRef.current?.focus();
      return;
    }

    const cleanPhone = phone.replace(/\s+/g, "");
    if (cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid Bangladesh mobile number (e.g. 01712345678).");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (!agreeTerms) {
      setErrorMessage("Please accept the terms of service to create your account.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerCustomer({
        fullName: cleanName,
        phone: cleanPhone,
        email: email.trim() || undefined,
        password,
        accountType,
        companyName: accountType === "WHOLESALE" ? companyName.trim() : undefined,
      });

      setIsSuccess(true);
      setTimeout(() => {
        window.location.href = redirectParam || "/";
      }, 400);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const raw = err instanceof Error ? err.message : "";
      if (raw.toLowerCase().includes("exists") || raw.toLowerCase().includes("duplicate")) {
        setErrorMessage("An account with this phone number or email already exists. Please sign in instead.");
      } else {
        setErrorMessage(raw || "Failed to create account. Please check your information and try again.");
      }
    }
  };

  // Handle Google Sign-Up
  const handleGoogleClick = () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    const target = redirectParam || "/";
    const effectiveClientId = googleConfig?.client_id || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (effectiveClientId) {
      try {
        const statePayload = JSON.stringify({
          redirect: target,
          ts: Date.now(),
        });
        const state = btoa(statePayload)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        const redirectUri = `${window.location.origin}/api/v1/auth/google/callback`;

        const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        googleAuthUrl.searchParams.set("client_id", effectiveClientId);
        googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
        googleAuthUrl.searchParams.set("response_type", "code");
        googleAuthUrl.searchParams.set("scope", "openid email profile");
        googleAuthUrl.searchParams.set("access_type", "online");
        googleAuthUrl.searchParams.set("prompt", "select_account");
        googleAuthUrl.searchParams.set("state", state);

        window.location.href = googleAuthUrl.toString();
        return;
      } catch {
        // Fallback
      }
    }

    const query = target ? `?redirect=${encodeURIComponent(target)}` : "";
    window.location.href = `/api/v1/auth/google${query}`;
  };
  return (
    <div className="register-root-container">
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

      {/* Main Responsive Registration Card */}
      <div className="register-main-card">
        {/* Left Column: Blue Wave with Wholesale/Trade Vector Illustration */}
        <div className="register-illustration-pane">
          <div className="illustration-wrapper">
            <RegisterIllustration />
          </div>

          <div className="illustration-caption">
            <span className="caption-brand">Nawabpur Complex Accessories</span>
            <span className="caption-pill">Wholesale & Trade Partner Registration</span>
          </div>
        </div>

        {/* Right Column: Clean White Registration Form */}
        <div className="register-form-pane">
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

            <h1 className="form-heading">Create your account</h1>
            <p className="form-subheading">
              Join NCAMart for wholesale trade prices, fast delivery & order tracking
            </p>
          </div>

          {/* Already Authenticated Banner */}
          {isAuthenticated && user && (
            <div className="active-session-banner">
              <div className="session-user-info">
                <strong>Signed in as:</strong> {user.name || user.email || user.phone}
              </div>
              <div className="session-actions">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = user.isStaff ? "/admin" : "/";
                  }}
                  className="btn-continue"
                >
                  Continue to Store →
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

          {/* Success Banner */}
          {isSuccess && (
            <div className="success-alert-banner" role="status">
              <span className="success-spinner"></span>
              <span>Account created successfully! Redirecting...</span>
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

          {/* Registration Form */}
          <form onSubmit={handleRegister} className="form-wrapper">
            {/* Account Type Selector Pills */}
            <div className="account-type-selector">
              <button
                type="button"
                className={`type-pill ${accountType === "RETAIL" ? "active" : ""}`}
                onClick={() => setAccountType("RETAIL")}
              >
                🛍️ Retail / Personal
              </button>
              <button
                type="button"
                className={`type-pill ${accountType === "WHOLESALE" ? "active" : ""}`}
                onClick={() => setAccountType("WHOLESALE")}
              >
                🏢 Wholesale / Trade Partner
              </button>
            </div>

            {/* Full Name */}
            <div className="field-group">
              <label className="field-label" htmlFor="fullNameInput">
                Full Name *
              </label>
              <div className="field-input-wrap">
                <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  id="fullNameInput"
                  ref={nameInputRef}
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setFullName(e.target.value);
                  }}
                  placeholder="e.g. Md. Ramzan Hossain"
                  required
                  autoComplete="name"
                  className="clean-text-input"
                  autoFocus
                />
              </div>
            </div>

            {/* Wholesale Business / Shop Name (Conditional) */}
            {accountType === "WHOLESALE" && (
              <div className="field-group animate-slide-down">
                <label className="field-label" htmlFor="companyInput">
                  Business / Shop Name *
                </label>
                <div className="field-input-wrap">
                  <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <input
                    id="companyInput"
                    type="text"
                    value={companyName}
                    onChange={(e) => {
                      setErrorMessage(null);
                      setCompanyName(e.target.value);
                    }}
                    placeholder="e.g. Nawabpur Electric & Machinery Store"
                    required={accountType === "WHOLESALE"}
                    className="clean-text-input"
                  />
                </div>
              </div>
            )}

            {/* Mobile Phone */}
            <div className="field-group">
              <label className="field-label" htmlFor="phoneInput">
                Mobile Phone Number *
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
                  required
                  autoComplete="tel"
                  className="clean-text-input prefix-padded"
                />
              </div>
            </div>

            {/* Email Address (Optional) */}
            <div className="field-group">
              <label className="field-label" htmlFor="emailInput">
                Email Address <span className="text-optional">(Optional)</span>
              </label>
              <div className="field-input-wrap">
                <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  id="emailInput"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setEmail(e.target.value);
                  }}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="clean-text-input"
                />
              </div>
            </div>

            {/* Password */}
            <div className="field-group">
              <label className="field-label" htmlFor="passwordInput">
                Password *
              </label>
              <div className="field-input-wrap">
                <svg className="field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="passwordInput"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setPassword(e.target.value);
                  }}
                  placeholder="At least 6 characters"
                  required
                  autoComplete="new-password"
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

              {/* Real-time Password Strength Meter */}
              {password && (
                <div className="password-strength-box">
                  <div className="strength-bar-track">
                    <div
                      className="strength-bar-fill"
                      style={{
                        width: `${(strength.score / 3) * 100}%`,
                        backgroundColor: strength.color,
                      }}
                    />
                  </div>
                  <span className="strength-label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Terms Agreement Checkbox */}
            <div className="terms-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="custom-checkbox"
                />
                <span>I agree to NCAMart terms, privacy policy & genuine warranty</span>
              </label>
            </div>

            {/* Submit Pill Button */}
            <div className="submit-row">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-pill-submit"
              >
                <span className="btn-circle-arrow">→</span>
                <span>{isSubmitting ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}</span>
              </button>
            </div>

            {/* Divider */}
            <div className="or-divider">
              <span>OR</span>
            </div>

            {/* Google Sign-Up Button */}
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
              <span>Sign up with Google</span>
            </button>

            {/* Link to Login */}
            <div className="signin-footer-box">
              <span>Already have an account? </span>
              <Link href="/auth/login" className="btn-signin-link">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Footer copyright */}
      <footer className="register-footer">
        <span>© {new Date().getFullYear()} NCAMart • Nawabpur Complex</span>
        <span className="dot-sep">•</span>
        <Link href="/" className="footer-link">Storefront Home</Link>
        <span className="dot-sep">•</span>
        <Link href="/auth/login" className="footer-link">Sign In</Link>
      </footer>

      {/* Scoped CSS Styles */}
      <style jsx>{`
        .register-root-container {
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

        /* Main Registration Card */
        .register-main-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 1000px;
          min-height: 560px;
          background: #ffffff;
          border-radius: 36px;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08);
          overflow: hidden;
          display: flex;
          flex-direction: row;
        }

        /* Left Side Illustration */
        .register-illustration-pane {
          flex: 1;
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

        /* Right Side Form Pane */
        .register-form-pane {
          flex: 1.1;
          background: #ffffff;
          padding: 40px 38px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          color: #1e293b;
        }

        .brand-header-area {
          margin-bottom: 20px;
        }

        .brand-logo-link {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .brand-logo-icon {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: #0066f5;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 19px;
          box-shadow: 0 4px 10px rgba(0, 102, 245, 0.3);
        }

        .brand-logo-texts {
          display: flex;
          flex-direction: column;
        }

        .brand-title {
          font-size: 21px;
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
          margin-top: 14px;
          margin-bottom: 4px;
          letter-spacing: -0.01em;
        }

        .form-subheading {
          font-size: 13px;
          color: #64748b;
          line-height: 1.4;
        }

        /* Account Type Switcher Pills */
        .account-type-selector {
          display: flex;
          background: #f1f5f9;
          border-radius: 999px;
          padding: 4px;
          gap: 4px;
          margin-bottom: 18px;
        }

        .type-pill {
          flex: 1;
          padding: 8px 12px;
          border-radius: 999px;
          border: none;
          background: transparent;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .type-pill.active {
          background: #ffffff;
          color: #0066f5;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        /* Active Session Alert */
        .active-session-banner {
          margin-bottom: 16px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
        }

        .session-user-info {
          color: #065f46;
        }

        .session-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-continue {
          padding: 5px 10px;
          border-radius: 8px;
          background: #0066f5;
          color: #ffffff;
          font-weight: 700;
          font-size: 11px;
          border: none;
          cursor: pointer;
        }

        .btn-signout {
          background: none;
          border: none;
          color: #64748b;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        /* Alerts */
        .success-alert-banner {
          margin-bottom: 16px;
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

        .error-alert-banner {
          margin-bottom: 16px;
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

        /* Form Fields */
        .form-wrapper {
          display: flex;
          flex-direction: column;
        }

        .field-group {
          margin-bottom: 15px;
        }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 4px;
        }

        .text-optional {
          font-weight: 400;
          color: #94a3b8;
          font-size: 11px;
        }

        .field-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          border-bottom: 1.5px solid #cbd5e1;
          transition: border-color 0.2s ease;
          padding-bottom: 3px;
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
          padding: 6px 0;
          font-weight: 500;
        }

        .clean-text-input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        .phone-prefix {
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          margin-right: 6px;
        }

        .prefix-padded {
          padding-left: 4px;
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

        /* Password Strength Meter */
        .password-strength-box {
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .strength-bar-track {
          flex: 1;
          height: 4px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .strength-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease, background-color 0.3s ease;
        }

        .strength-label {
          font-size: 11px;
          font-weight: 700;
        }

        /* Terms */
        .terms-row {
          margin-top: 6px;
          margin-bottom: 18px;
        }

        .checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          color: #64748b;
          cursor: pointer;
          user-select: none;
          line-height: 1.4;
        }

        .custom-checkbox {
          width: 15px;
          height: 15px;
          accent-color: #0066f5;
          margin-top: 2px;
          cursor: pointer;
        }

        /* Submit Button */
        .submit-row {
          margin-top: 2px;
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
          margin: 16px 0;
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

        /* Google Sign Up */
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

        /* Link to Sign In */
        .signin-footer-box {
          margin-top: 16px;
          text-align: center;
          font-size: 13px;
          color: #64748b;
        }

        .btn-signin-link {
          font-weight: 700;
          color: #0066f5;
          text-decoration: none;
        }

        .btn-signin-link:hover {
          text-decoration: underline;
        }

        /* Footer */
        .register-footer {
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

        /* Responsive Mobile Layout */
        @media (max-width: 860px) {
          .register-main-card {
            flex-direction: column;
            border-radius: 28px;
            max-width: 440px;
          }

          .register-illustration-pane {
            min-height: 220px;
            padding: 20px;
          }

          .banner-illustration-svg {
            max-height: 180px;
          }

          .illustration-caption {
            display: none;
          }

          .register-form-pane {
            padding: 30px 22px;
          }

          .form-heading {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", backgroundColor: "#16181d", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}>
          <div>Loading Register Portal...</div>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}

