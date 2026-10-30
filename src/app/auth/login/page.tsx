"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/ui/toast";

// Vector Illustration matching the mockup (Office worker at desk with computer & lush plants)
function LoginIllustration() {
  return (
    <svg
      viewBox="0 0 540 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full max-h-[520px] select-none object-contain drop-shadow-xl"
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
        {/* Desk top */}
        <rect x="180" y="380" width="220" height="14" rx="4" fill="#475569" filter="url(#softShadow)" />
        {/* Right drawer cabinet / leg */}
        <rect x="330" y="394" width="70" height="106" rx="4" fill="#334155" />
        <rect x="335" y="405" width="60" height="26" rx="2" fill="#1e293b" />
        <circle cx="365" cy="418" r="3" fill="#94a3b8" />
        <rect x="335" y="438" width="60" height="26" rx="2" fill="#1e293b" />
        <circle cx="365" cy="451" r="3" fill="#94a3b8" />
        {/* Desk left leg */}
        <rect x="195" y="394" width="10" height="106" rx="3" fill="#334155" />
      </g>

      {/* Modern Desktop Monitor on Desk */}
      <g id="computerMonitor">
        {/* Monitor Screen Frame */}
        <rect x="290" y="275" width="115" height="85" rx="6" fill="#0f172a" />
        {/* Active Display Screen */}
        <rect x="296" y="281" width="103" height="73" rx="4" fill="#1e293b" />
        {/* Mock Code / UI on screen */}
        <rect x="304" y="290" width="45" height="6" rx="2" fill="#38bdf8" />
        <rect x="304" y="302" width="75" height="4" rx="2" fill="#64748b" />
        <rect x="304" y="311" width="60" height="4" rx="2" fill="#64748b" />
        <rect x="304" y="320" width="50" height="4" rx="2" fill="#10b981" />
        {/* Stand stem & base */}
        <rect x="342" y="360" width="10" height="20" fill="#64748b" />
        <ellipse cx="347" cy="380" rx="20" ry="4" fill="#475569" />
      </g>

      {/* Ergonomic Office Chair */}
      <g id="officeChair">
        {/* Chair Backrest */}
        <path d="M190 280 C180 280 175 320 180 390 C185 415 210 425 225 425 Z" fill="#0f172a" />
        {/* Seat cushion */}
        <rect x="185" y="415" width="70" height="16" rx="8" fill="#1e293b" />
        {/* Chair Central Stand */}
        <rect x="215" y="431" width="8" height="65" fill="#64748b" />
        {/* Swivel Legs & Wheels */}
        <path d="M219 490 L185 506" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
        <path d="M219 490 L250 506" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
        <circle cx="185" cy="508" r="5" fill="#0f172a" />
        <circle cx="250" cy="508" r="5" fill="#0f172a" />
      </g>

      {/* Worker Character Sitting */}
      <g id="workerSitting">
        {/* Blue Trousers / Legs */}
        {/* Left leg tucked */}
        <path d="M220 420 C240 440 255 460 255 500 L240 505 C230 465 215 445 205 425 Z" fill="#1d4ed8" />
        {/* Left Shoe */}
        <ellipse cx="250" cy="506" rx="14" ry="7" fill="#0f172a" />
        {/* Right leg extended */}
        <path d="M225 420 C250 435 285 450 310 520 L290 525 C270 465 240 445 215 425 Z" fill="#2563eb" />
        {/* Right Shoe */}
        <ellipse cx="305" cy="525" rx="16" ry="8" fill="#0f172a" />

        {/* Torso / Crisp White Shirt */}
        <path d="M205 315 C220 315 245 330 248 420 L205 420 C195 380 195 335 205 315 Z" fill="#ffffff" />

        {/* Emerald Green Tie */}
        <polygon points="228,325 233,325 235,390 230,400 226,390" fill="#10b981" />

        {/* Coffee Mug in Right Hand */}
        <rect x="250" y="360" width="16" height="18" rx="3" fill="#ef4444" />
        <path d="M266 364 C271 364 271 374 266 374" stroke="#ef4444" strokeWidth="2.5" fill="none" />
        {/* Steam */}
        <path d="M255 354 Q253 348 256 342" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M260 355 Q262 349 259 344" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />

        {/* Arm holding mug */}
        <path d="M235 335 C248 345 255 355 252 368" stroke="#ffffff" strokeWidth="16" strokeLinecap="round" />
        {/* Hand */}
        <circle cx="253" cy="370" r="7" fill="#fed7aa" />

        {/* Head & Neck */}
        <rect x="220" y="295" width="14" height="24" rx="6" fill="#fed7aa" />
        <circle cx="228" cy="285" r="18" fill="#fed7aa" />

        {/* Stylized Modern Dark Hair */}
        <path d="M212 284 C210 265 225 255 240 258 C250 260 252 272 248 282 C242 272 232 270 220 274 Z" fill="#0f172a" />
      </g>

      {/* Right Foliage Plants (Tropical Layers) */}
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "";

  const { smartLogin, loginWithGoogle, sendCustomerOtp, verifyCustomerOtp, isAuthenticated, user, logout } = useAuth();

  // Primary Login State
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; client_id: string } | null>(null);

  // Fetch Google OAuth settings dynamically
  useEffect(() => {
    let isMounted = true;
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

  // Handle Smart Unified Login (Staff -> /admin, Customer -> /)
  const handleSmartLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage("Please enter your Username, Email, or Mobile number.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await smartLogin(identifier.trim(), password, requires2Fa ? totpCode.trim() : undefined);

      if (res.requiresTotp) {
        setRequires2Fa(true);
        toast({
          title: "2FA Verification Required",
          description: "Staff account detected. Enter the 6-digit code from Google Authenticator.",
          variant: "warning",
        });
        return;
      }

      toast({
        title: res.isStaff ? "Backoffice Verified" : "Welcome Back",
        description: res.isStaff ? "Redirecting to Admin Panel..." : "Redirecting to NCAMart Store...",
        variant: "success",
      });

      // Role-based smart redirect
      if (res.isStaff) {
        router.push(redirectParam || "/admin");
      } else {
        router.push(redirectParam || "/");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Authentication failed. Please verify credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleClick = async () => {
    setErrorMessage(null);

    if (!googleConfig?.enabled || !googleConfig?.client_id) {
      toast({
        title: "Google Sign-In Setup Required",
        description: "Google OAuth is not configured yet. Configure Client ID in Admin Settings -> Google Sign-In.",
        variant: "info",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // If running with Google Identity Services
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
                toast({
                  title: "Staff 2FA Required",
                  description: "Enter your 6-digit authenticator code to proceed to Admin.",
                  variant: "warning",
                });
                return;
              }
              toast({
                title: "Signed In with Google",
                description: res.isStaff ? "Redirecting to Admin..." : "Redirecting to Storefront...",
                variant: "success",
              });
              router.push(redirectParam || (res.isStaff ? "/admin" : "/"));
            }
          },
        });
        win.google.accounts.id.prompt();
      } else {
        // Fallback info
        toast({
          title: "Google Authentication",
          description: "Connecting with Google Identity Services...",
          variant: "info",
        });
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setIsSubmitting(false);
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
      toast({
        title: "OTP Dispatched",
        description: res.message || "6-digit OTP code sent via SMS / WhatsApp.",
        variant: "info",
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to dispatch OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (customerOtp.trim().length !== 6) {
      setErrorMessage("Enter the full 6-digit OTP code.");
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyCustomerOtp(phone.replace(/\s+/g, ""), customerOtp.trim());
      toast({
        title: "OTP Verified",
        description: "Welcome to NCAMart! Redirecting...",
        variant: "success",
      });
      router.push(redirectParam || "/");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid or expired OTP code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#14161a] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-10 relative overflow-hidden select-text">
      {/* Subtle background decoration resembling mockup design presentation */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 50,100 Q 250,50 450,150 T 850,200"
            fill="none"
            stroke="#22c55e"
            strokeWidth="3"
            strokeDasharray="12 12"
          />
          <path
            d="M 100,500 Q 400,600 700,450 T 1200,600"
            fill="none"
            stroke="#0066f5"
            strokeWidth="3"
            strokeDasharray="16 16"
          />
        </svg>
      </div>

      {/* Main Card Container */}
      <div className="relative z-10 w-full max-w-[1040px] bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 border border-slate-200/80">
        {/* Left Side: Modern Blue Wave & Office Graphic */}
        <div className="md:col-span-6 bg-[#0066f5] relative flex flex-col items-center justify-center p-6 sm:p-8 min-h-[320px] md:min-h-[580px] overflow-hidden">
          <LoginIllustration />

          {/* Quick Info Overlay for Nawabpur Complex Accessories */}
          <div className="absolute bottom-4 left-6 right-6 hidden md:flex items-center justify-between text-white/80 text-xs tracking-wide">
            <span className="font-semibold text-white">Nawabpur Complex Accessories</span>
            <span className="bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full font-mono text-[11px]">
              Secure Backoffice & Commerce
            </span>
          </div>
        </div>

        {/* Right Side: Clean White Login Form */}
        <div className="md:col-span-6 bg-white p-8 sm:p-12 lg:p-14 flex flex-col justify-center text-slate-800">
          {/* Brand Logo & Header */}
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2 group">
              {/* Modern Logo Icon */}
              <div className="w-10 h-10 rounded-xl bg-[#0066f5] text-white flex items-center justify-center font-black text-2xl shadow-md group-hover:scale-105 transition-transform">
                N
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                  ncamart<span className="text-[#0066f5]">.</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">
                  Nawabpur Complex
                </span>
              </div>
            </Link>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mt-5">
              {requires2Fa ? "Security Verification" : "Acesse sua conta"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {requires2Fa
                ? "Staff 2-Factor Authentication (Google Authenticator)"
                : "Sign in to access your dashboard, orders & wholesale prices"}
            </p>
          </div>

          {/* Active Session Notification */}
          {isAuthenticated && user && !requires2Fa && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-sm">
              <div className="text-emerald-900">
                <span className="font-bold">Signed in as:</span> {user.name || user.email || user.phone}
                <span className="ml-1.5 text-xs bg-emerald-200/70 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                  {user.isStaff ? "Staff / Backoffice" : "Customer"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={user.isStaff ? "/admin" : redirectParam || "/"}
                  className="px-3 py-1.5 bg-[#0066f5] text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition"
                >
                  Continue →
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 font-semibold transition"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium flex items-center gap-2 animate-shake">
              <svg className="w-5 h-5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ===================== MODE 1: 2FA TOTP VERIFICATION ===================== */}
          {requires2Fa ? (
            <form onSubmit={handleSmartLogin} className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                  🛡️
                </div>
                <div className="text-xs text-blue-950">
                  <p className="font-bold">2FA Enabled on Staff Account</p>
                  <p className="text-blue-700 mt-0.5">
                    Open Google Authenticator or your 2FA app on your phone and enter the current 6-digit code.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  6-Digit Authenticator Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000 000"
                  className="w-full text-center tracking-[0.4em] font-mono text-2xl font-black py-3.5 px-4 bg-slate-50 border-2 border-blue-500/40 focus:border-blue-600 rounded-2xl outline-none transition"
                  autoFocus
                  required
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || totpCode.trim().length !== 6}
                  className="w-full h-12 rounded-full bg-[#0066f5] hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="w-7 h-7 rounded-full bg-[#22c55e] flex items-center justify-center text-white text-xs font-black">
                    →
                  </span>
                  <span>{isSubmitting ? "Verifying..." : "Verify & Access Admin"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRequires2Fa(false);
                    setTotpCode("");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold py-2 text-center"
                >
                  ← Back to Login Credentials
                </button>
              </div>
            </form>
          ) : useOtpMode ? (
            /* ===================== MODE 2: CUSTOMER SMS OTP ===================== */
            otpStep === "PHONE" ? (
              <form onSubmit={handleSendOtp} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Mobile Phone Number (Bangladesh)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-slate-400 font-semibold text-sm">
                      🇧🇩 +88
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01712 345678"
                      className="w-full pl-20 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-slate-900 font-medium outline-none transition"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-full bg-[#0066f5] hover:bg-blue-700 text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg transition"
                >
                  <span className="w-7 h-7 rounded-full bg-[#22c55e] flex items-center justify-center text-white text-xs font-black">
                    →
                  </span>
                  <span>{isSubmitting ? "Sending..." : "Send Verification SMS"}</span>
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setUseOtpMode(false)}
                    className="text-xs text-[#0066f5] hover:underline font-semibold"
                  >
                    ← Sign in with Password / Username instead
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Enter 6-Digit OTP sent to {phone}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={customerOtp}
                    onChange={(e) => setCustomerOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full text-center tracking-[0.4em] font-mono text-2xl font-black py-3 bg-slate-50 border border-blue-500 rounded-xl outline-none"
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || customerOtp.trim().length !== 6}
                  className="w-full h-12 rounded-full bg-[#0066f5] hover:bg-blue-700 text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg transition"
                >
                  <span className="w-7 h-7 rounded-full bg-[#22c55e] flex items-center justify-center text-white text-xs font-black">
                    →
                  </span>
                  <span>{isSubmitting ? "Verifying..." : "Verify OTP & Sign In"}</span>
                </button>

                <div className="flex justify-between text-xs text-slate-500 font-semibold">
                  <button type="button" onClick={() => setOtpStep("PHONE")} className="hover:text-slate-800">
                    Change Number
                  </button>
                  <button type="button" onClick={() => setUseOtpMode(false)} className="text-[#0066f5] hover:underline">
                    Use Password
                  </button>
                </div>
              </form>
            )
          ) : (
            /* ===================== MODE 3: DEFAULT SMART LOGIN ===================== */
            <form onSubmit={handleSmartLogin} className="space-y-5">
              {/* Email / Username / Phone Input */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Email, Username, or Phone
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@example.com or admin"
                    autoComplete="username"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-transparent border-b border-slate-300 focus:border-[#0066f5] text-slate-900 text-sm outline-none transition placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="relative pt-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Senha / Password
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-transparent border-b border-slate-300 focus:border-[#0066f5] text-slate-900 text-sm outline-none transition placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password Row */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-500 hover:text-slate-800">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#0066f5] focus:ring-0 focus:outline-none"
                  />
                  <span>Manter-me conectado</span>
                </label>

                <Link
                  href="/account/reset-password"
                  className="text-slate-400 hover:text-[#0066f5] transition"
                >
                  Esqueceu a senha?
                </Link>
              </div>

              {/* Primary Action Button: Pill with Green Circle Arrow */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-full bg-[#0066f5] hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25 transition disabled:opacity-60"
                >
                  <span className="w-7 h-7 rounded-full bg-[#22c55e] flex items-center justify-center text-white text-xs font-black shadow-inner">
                    →
                  </span>
                  <span>{isSubmitting ? "SIGNING IN..." : "ENTRAR"}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <span className="relative bg-white px-3 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  OU
                </span>
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isSubmitting}
                className="w-full h-11 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2.5 transition active:scale-[0.99]"
              >
                {/* Official Google G Logo */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setUseOtpMode(true)}
                  className="text-xs text-slate-500 hover:text-[#0066f5] font-medium transition"
                >
                  📱 Use Bangladesh Mobile SMS OTP instead
                </button>
              </div>

              {/* Create Account Link */}
              <div className="pt-3 text-center">
                <Link
                  href="/register"
                  className="text-xs text-[#0066f5] hover:underline font-semibold"
                >
                  Criar uma conta
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer copyright */}
      <div className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center gap-4">
        <span>© {new Date().getFullYear()} NCAMart • Nawabpur Complex</span>
        <span>•</span>
        <Link href="/" className="hover:text-slate-300">
          Storefront Home
        </Link>
        <span>•</span>
        <Link href="/admin" className="hover:text-slate-300">
          Admin Backoffice
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#14161a] flex items-center justify-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
