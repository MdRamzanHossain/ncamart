"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

interface StaffSelfProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  roles: string[];
  totp_enabled: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at?: string;
  updated_at?: string;
}

interface StaffSessionItem {
  id: string;
  ip: string;
  user_agent: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  is_current: boolean;
}

interface StaffPreferences {
  defaultConsole: "/admin" | "/pos" | "/runner";
  language: "en" | "bn";
  assignedHub: string;
  designation: string;
  emergencyPhone: string;
  shiftNotes: string;
  printerFormat: "80MM_POS" | "50X25_SEAL" | "A4_INVOICE";
  soundAlerts: boolean;
  compactTables: boolean;
  idleLockMinutes: "15" | "30" | "60" | "720";
}

const DEFAULT_PREFERENCES: StaffPreferences = {
  defaultConsole: "/admin",
  language: "en",
  assignedHub: "Nawabpur Central Godown & HQ",
  designation: "Operations & Systems Administrator",
  emergencyPhone: "+8801700000000",
  shiftNotes: "Primary on-call engineering & fulfillment escalation.",
  printerFormat: "80MM_POS",
  soundAlerts: true,
  compactTables: false,
  idleLockMinutes: "60",
};

type SettingsTab = "PROFILE" | "PASSWORD" | "TWO_FACTOR" | "GOOGLE_AUTH" | "PREFERENCES";

export function StaffSettingsView() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("PROFILE");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Staff profile state
  const [profile, setProfile] = useState<StaffSelfProfile | null>(null);
  const [sessions, setSessions] = useState<StaffSessionItem[]>([]);

  // Form 1: Profile & Contact Details
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Form 2: Password Change
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Form 3: 2FA TOTP Setup & Management
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [isTotpBusy, setIsTotpBusy] = useState(false);

  // Form 4: Extended Details & Operational Preferences
  const [prefs, setPrefs] = useState<StaffPreferences>(DEFAULT_PREFERENCES);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);

  // Form 5: Google OAuth & Sign-In Settings
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleRedirectUri, setGoogleRedirectUri] = useState("");
  const [googleSecretMasked, setGoogleSecretMasked] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [isSavingGoogle, setIsSavingGoogle] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  // Load current staff profile from backend + localStorage fallback
  const fetchSelfProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      if (typeof window !== "undefined") {
        const rawPrefs = localStorage.getItem("nca_staff_prefs");
        if (rawPrefs) {
          try {
            setPrefs({ ...DEFAULT_PREFERENCES, ...JSON.parse(rawPrefs) });
          } catch {
            // ignore
          }
        }
      }

      const res = await api.get<{
        staff: StaffSelfProfile;
        sessions: StaffSessionItem[];
      }>("/api/v1/auth/staff/me");

      if (res?.staff) {
        setProfile(res.staff);
        setFullName(res.staff.full_name || "");
        setEmail(res.staff.email || "");
        setPhone(res.staff.phone || "");
        setSessions(res.sessions || []);
      }
    } catch {
      if (typeof window !== "undefined") {
        const rawUser = localStorage.getItem("nca_user");
        if (rawUser) {
          try {
            const parsed = JSON.parse(rawUser);
            const fallbackProfile: StaffSelfProfile = {
              id: parsed.id || "STAFF-001",
              full_name: parsed.name || "Admin Staff",
              email: parsed.email || "admin@ncamart.com",
              phone: parsed.phone || "+8801700000000",
              status: "ACTIVE",
              roles: parsed.permissions || [parsed.role || "SUPER_ADMIN"],
              totp_enabled: false,
              must_change_password: false,
              last_login_at: new Date().toISOString(),
            };
            setProfile(fallbackProfile);
            setFullName(fallbackProfile.full_name);
            setEmail(fallbackProfile.email);
            setPhone(fallbackProfile.phone);
          } catch {
            // ignore
          }
        }
      }
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  const fetchGoogleSettings = useCallback(async () => {
    setIsLoadingGoogle(true);
    try {
      const res = await api.get<{
        enabled: boolean;
        client_id: string;
        client_secret_masked: string;
        has_secret: boolean;
        redirect_uri: string;
      }>("/api/v1/admin/settings/google-auth");

      if (res) {
        setGoogleEnabled(Boolean(res.enabled));
        setGoogleClientId(res.client_id || "");
        setGoogleSecretMasked(res.client_secret_masked || "");
        setHasSecret(Boolean(res.has_secret));
        setGoogleRedirectUri(
          res.redirect_uri ||
            (typeof window !== "undefined"
              ? `${window.location.origin}/api/v1/auth/google/callback`
              : "")
        );
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingGoogle(false);
    }
  }, []);

  useEffect(() => {
    fetchSelfProfile();
    fetchGoogleSettings();
  }, [fetchSelfProfile, fetchGoogleSettings]);

  const validateProfileField = (field: "fullName" | "email" | "phone", value: string) => {
    const trimmed = value.trim();
    if (field === "fullName") {
      if (trimmed.length < 2) {
        setProfileErrors((prev) => ({ ...prev, fullName: "Full name must be at least 2 characters." }));
        return false;
      }
    }
    if (field === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setProfileErrors((prev) => ({ ...prev, email: "Please enter a valid work email address." }));
        return false;
      }
    }
    if (field === "phone") {
      const cleaned = trimmed.replace(/[\s-]/g, "");
      if (!/^(\+?8801|01)[3-9]\d{8}$/.test(cleaned)) {
        setProfileErrors((prev) => ({
          ...prev,
          phone: "Enter a valid Bangladesh mobile number (e.g. +8801712345678 or 01712345678).",
        }));
        return false;
      }
    }
    return true;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const okName = validateProfileField("fullName", fullName);
    const okEmail = validateProfileField("email", email);
    const okPhone = validateProfileField("phone", phone);
    if (!okName || !okEmail || !okPhone) return;

    setIsSavingProfile(true);
    try {
      const res = await api.patch<{ staff: StaffSelfProfile }>("/api/v1/auth/staff/me", {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      });

      const updatedStaff = res.staff;
      setProfile((prev) => (prev ? { ...prev, ...updatedStaff } : updatedStaff));
      setPhone(updatedStaff.phone);

      if (typeof window !== "undefined") {
        localStorage.setItem("nca_staff_prefs", JSON.stringify(prefs));
        const rawUser = localStorage.getItem("nca_user");
        const existingUser = rawUser ? JSON.parse(rawUser) : {};
        const nextUser = {
          ...existingUser,
          name: updatedStaff.full_name,
          email: updatedStaff.email,
          phone: updatedStaff.phone,
          assignedLocation: prefs.assignedHub,
          isStaff: true,
        };
        localStorage.setItem("nca_user", JSON.stringify(nextUser));
        window.dispatchEvent(new CustomEvent("nca-staff-profile-updated", { detail: nextUser }));
      }

      addToast({
        title: "Profile Updated Successfully",
        description: `Your name (${updatedStaff.full_name}), email, and mobile number (${updatedStaff.phone}) have been saved.`,
        variant: "success",
      });
    } catch (err: unknown) {
      addToast({
        title: "Failed to Update Profile",
        description: err instanceof Error ? err.message : "Could not update your profile details.",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const validatePasswordField = (field: "oldPassword" | "newPassword" | "confirmPassword", val: string) => {
    if (field === "oldPassword" && !val) {
      setPasswordErrors((prev) => ({ ...prev, oldPassword: "Current password is required." }));
      return false;
    }
    if (field === "newPassword" && val.length < 8) {
      setPasswordErrors((prev) => ({
        ...prev,
        newPassword: "New password must be at least 8 characters long.",
      }));
      return false;
    }
    if (field === "confirmPassword" && val !== newPassword) {
      setPasswordErrors((prev) => ({
        ...prev,
        confirmPassword: "Confirmation password does not match new password.",
      }));
      return false;
    }
    return true;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const okOld = validatePasswordField("oldPassword", oldPassword);
    const okNew = validatePasswordField("newPassword", newPassword);
    const okConfirm = validatePasswordField("confirmPassword", confirmPassword);
    if (!okOld || !okNew || !okConfirm) return;

    setIsSavingPassword(true);
    try {
      await api.post("/api/v1/auth/staff/me", {
        action: "change_password",
        old_password: oldPassword,
        new_password: newPassword,
      });

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordErrors({});
      setProfile((prev) => (prev ? { ...prev, must_change_password: false } : prev));

      addToast({
        title: "Password Changed Successfully",
        description: "Your Argon2id encrypted password has been updated in the database.",
        variant: "success",
      });
    } catch (err: unknown) {
      addToast({
        title: "Password Change Failed",
        description: err instanceof Error ? err.message : "Current password did not match.",
        variant: "destructive",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleStartTotpEnrollment = async () => {
    setTotpError(null);
    setIsTotpBusy(true);
    try {
      const res = await api.post<{ secret: string; otpauth_url: string; email: string }>(
        "/api/v1/auth/staff/me",
        { action: "totp_init" }
      );
      setTotpSecret(res.secret);
      setTotpUri(res.otpauth_url);
      setTotpCode("");
      addToast({
        title: "2FA Secret Key Generated",
        description: "Scan the QR code or enter the secret key in Google Authenticator / Authy.",
        variant: "info",
      });
    } catch (err: unknown) {
      setTotpError(err instanceof Error ? err.message : "Failed to initialize 2FA setup.");
    } finally {
      setIsTotpBusy(false);
    }
  };

  const handleConfirmTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError(null);
    const cleaned = totpCode.trim();
    if (!/^\d{6}$/.test(cleaned)) {
      setTotpError("Please enter the 6-digit numeric code from your authenticator app.");
      return;
    }

    setIsTotpBusy(true);
    try {
      const res = await api.post<{ totp_enabled: boolean; message: string }>(
        "/api/v1/auth/staff/me",
        {
          action: "totp_confirm",
          totp_code: cleaned,
        }
      );
      setProfile((prev) => (prev ? { ...prev, totp_enabled: res.totp_enabled } : prev));
      setTotpSecret(null);
      setTotpUri(null);
      setTotpCode("");

      addToast({
        title: "2FA Authenticator Enabled! 🛡️",
        description: res.message,
        variant: "success",
      });
    } catch (err: unknown) {
      setTotpError(err instanceof Error ? err.message : "Invalid 6-digit verification code.");
    } finally {
      setIsTotpBusy(false);
    }
  };

  const handleDisableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError(null);
    if (!disablePassword) {
      setTotpError("Please enter your current password to disable 2FA.");
      return;
    }

    setIsTotpBusy(true);
    try {
      const res = await api.post<{ totp_enabled: boolean; message: string }>(
        "/api/v1/auth/staff/me",
        {
          action: "totp_disable",
          password: disablePassword,
        }
      );
      setProfile((prev) => (prev ? { ...prev, totp_enabled: res.totp_enabled } : prev));
      setDisablePassword("");
      setTotpSecret(null);
      setTotpUri(null);

      addToast({
        title: "2FA Disabled",
        description: res.message,
        variant: "info",
      });
    } catch (err: unknown) {
      setTotpError(err instanceof Error ? err.message : "Could not disable 2FA. Check your password.");
    } finally {
      setIsTotpBusy(false);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrefs(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("nca_staff_prefs", JSON.stringify(prefs));
        const rawUser = localStorage.getItem("nca_user");
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          const nextUser = { ...parsed, assignedLocation: prefs.assignedHub };
          localStorage.setItem("nca_user", JSON.stringify(nextUser));
          window.dispatchEvent(new CustomEvent("nca-staff-profile-updated", { detail: nextUser }));
        }
      }
      addToast({
        title: "Workspace Preferences Saved",
        description: "Your console defaults, hub location, and printer settings have been updated.",
        variant: "success",
      });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleSaveGoogleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGoogle(true);
    try {
      await api.post("/api/v1/admin/settings/google-auth", {
        enabled: googleEnabled,
        client_id: googleClientId.trim(),
        client_secret: googleClientSecret.trim() || undefined,
        redirect_uri: googleRedirectUri.trim(),
      });
      addToast({
        title: "Google OAuth Configuration Saved",
        description: `Google Sign-In is now ${googleEnabled ? "ENABLED" : "DISABLED"} across login portals.`,
        variant: "success",
      });
      fetchGoogleSettings();
      setGoogleClientSecret("");
    } catch (err: unknown) {
      addToast({
        title: "Failed to Save Google Settings",
        description: err instanceof Error ? err.message : "Error saving configuration.",
        variant: "destructive",
      });
    } finally {
      setIsSavingGoogle(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setIsRevokingSessions(true);
    try {
      const res = await api.post<{ revoked_count: number; message: string }>(
        "/api/v1/auth/staff/me",
        { action: "revoke_other_sessions" }
      );
      await fetchSelfProfile();
      addToast({
        title: "Sessions Revoked",
        description: res.message,
        variant: "success",
      });
    } catch (err: unknown) {
      addToast({
        title: "Failed to Revoke Sessions",
        description: err instanceof Error ? err.message : "Could not revoke other sessions.",
        variant: "destructive",
      });
    } finally {
      setIsRevokingSessions(false);
    }
  };

  const initials = (fullName || profile?.full_name || "Admin")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "AD";

  return (
    <div className="staff-settings-container" data-testid="staff-settings-view">
      {/* Page Header & Live Identity Banner */}
      <div className="settings-hero-card">
        <div className="hero-left">
          <div className="avatar-badge">{initials}</div>
          <div className="hero-meta">
            <div className="hero-name-row">
              <h1 className="hero-title">{fullName || profile?.full_name || "Staff Member"}</h1>
              <span className={`status-pill ${profile?.totp_enabled ? "totp-on" : "totp-off"}`}>
                {profile?.totp_enabled ? "🛡️ 2FA TOTP Active" : "⚠️ 2FA Not Enabled"}
              </span>
            </div>
            <p className="hero-subtitle">
              {email || profile?.email} • {phone || profile?.phone} • {prefs.assignedHub}
            </p>
            <div className="role-chips-row">
              {(profile?.roles || ["SUPER_ADMIN"]).map((r) => (
                <span key={r} className="role-chip">
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="security-score-box">
            <span className="score-label">Account Security Status</span>
            <span className="score-val">
              {profile?.totp_enabled ? "HIGH (Argon2id + 2FA)" : "STANDARD (Password Only)"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="settings-tabs" role="tablist" aria-label="Staff Account Settings Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "PROFILE"}
          className={`tab-btn ${activeTab === "PROFILE" ? "active" : ""}`}
          onClick={() => setActiveTab("PROFILE")}
        >
          <span>👤</span>
          <span>Profile & Contact Details</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "PASSWORD"}
          className={`tab-btn ${activeTab === "PASSWORD" ? "active" : ""}`}
          onClick={() => setActiveTab("PASSWORD")}
        >
          <span>🔑</span>
          <span>Change Password</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "TWO_FACTOR"}
          className={`tab-btn ${activeTab === "TWO_FACTOR" ? "active" : ""}`}
          onClick={() => setActiveTab("TWO_FACTOR")}
        >
          <span>🛡️</span>
          <span>2FA Authenticator Setup</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "GOOGLE_AUTH"}
          className={`tab-btn ${activeTab === "GOOGLE_AUTH" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("GOOGLE_AUTH");
            fetchGoogleSettings();
          }}
        >
          <span>🌐</span>
          <span>Google Sign-In & OAuth</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "PREFERENCES"}
          className={`tab-btn ${activeTab === "PREFERENCES" ? "active" : ""}`}
          onClick={() => setActiveTab("PREFERENCES")}
        >
          <span>⚙️</span>
          <span>Preferences & Active Sessions</span>
        </button>
      </div>

      {isLoadingProfile ? (
        <div className="settings-card">
          <p style={{ color: "#94a3b8", margin: 0 }}>Loading your staff account settings...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: PROFILE & CONTACT DETAILS */}
          {activeTab === "PROFILE" && (
            <form onSubmit={handleSaveProfile} method="POST" action="/api/v1/auth/staff/me" className="settings-card" noValidate>
              <fieldset className="settings-fieldset">
                <legend className="fieldset-legend">Personal Identity & Contact Information</legend>
                <p className="fieldset-desc">
                  Update your display name, official email, mobile number, and Nawabpur duty station details. Changes take effect immediately across the Admin Backoffice and audit logs.
                </p>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="staff-full-name" className="form-label">
                      Full Name
                    </label>
                    <input
                      id="staff-full-name"
                      name="full_name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (profileErrors.fullName) {
                          setProfileErrors((prev) => ({ ...prev, fullName: "" }));
                        }
                      }}
                      onBlur={(e) => validateProfileField("fullName", e.target.value)}
                      aria-describedby="staff-full-name-help"
                      className="form-input"
                    />
                    <div id="staff-full-name-help" className="form-help">
                      {profileErrors.fullName ? (
                        <span className="err-text">{profileErrors.fullName}</span>
                      ) : (
                        "Displayed in the Admin Sidebar, QC certificates, and audit trail."
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="staff-email" className="form-label">
                      Official Email Address
                    </label>
                    <input
                      id="staff-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (profileErrors.email) {
                          setProfileErrors((prev) => ({ ...prev, email: "" }));
                        }
                      }}
                      onBlur={(e) => validateProfileField("email", e.target.value)}
                      aria-describedby="staff-email-help"
                      className="form-input"
                    />
                    <div id="staff-email-help" className="form-help">
                      {profileErrors.email ? (
                        <span className="err-text">{profileErrors.email}</span>
                      ) : (
                        "Used for staff sign-in and 2FA authenticator account binding."
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="staff-phone" className="form-label">
                      Bangladesh Mobile Number
                    </label>
                    <input
                      id="staff-phone"
                      name="phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      autoCorrect="off"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (profileErrors.phone) {
                          setProfileErrors((prev) => ({ ...prev, phone: "" }));
                        }
                      }}
                      onBlur={(e) => validateProfileField("phone", e.target.value)}
                      placeholder="+88017XXXXXXXX"
                      aria-describedby="staff-phone-help"
                      className="form-input mono-input"
                    />
                    <div id="staff-phone-help" className="form-help">
                      {profileErrors.phone ? (
                        <span className="err-text">{profileErrors.phone}</span>
                      ) : (
                        "Normalized to E.164 (+8801...). Can also be used as your login identifier."
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="staff-designation" className="form-label">
                      Designation / Job Title
                    </label>
                    <input
                      id="staff-designation"
                      name="designation"
                      type="text"
                      autoComplete="organization-title"
                      value={prefs.designation}
                      onChange={(e) => setPrefs((prev) => ({ ...prev, designation: e.target.value }))}
                      className="form-input"
                    />
                    <div className="form-help">Your operational title within Nawabpur Complex Accessories.</div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="staff-hub" className="form-label">
                      Assigned Duty Hub / Location
                    </label>
                    <select
                      id="staff-hub"
                      name="assigned_hub"
                      value={prefs.assignedHub}
                      onChange={(e) => setPrefs((prev) => ({ ...prev, assignedHub: e.target.value }))}
                      className="form-input"
                    >
                      <option value="Nawabpur Central Godown & HQ">Nawabpur Central Godown & HQ</option>
                      <option value="Shop 42, Showroom & Counter POS">Shop 42, Showroom & Counter POS</option>
                      <option value="Sundarban Square Level 4 Packing Hub">Sundarban Square Level 4 Packing Hub</option>
                      <option value="Nawabpur Tower Level 2 QC Lab">Nawabpur Tower Level 2 QC Lab</option>
                      <option value="Stadium Market Field Runner Relay">Stadium Market Field Runner Relay</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="staff-emergency-phone" className="form-label">
                      Emergency Escalation Number
                    </label>
                    <input
                      id="staff-emergency-phone"
                      name="emergency_phone"
                      type="tel"
                      autoComplete="tel"
                      value={prefs.emergencyPhone}
                      onChange={(e) => setPrefs((prev) => ({ ...prev, emergencyPhone: e.target.value }))}
                      className="form-input mono-input"
                    />
                    <div className="form-help">Secondary contact for urgent godown or courier dispatch alerts.</div>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: "16px" }}>
                  <label htmlFor="staff-shift-notes" className="form-label">
                    Shift Schedule & Handover Notes
                  </label>
                  <textarea
                    id="staff-shift-notes"
                    name="shift_notes"
                    rows={3}
                    value={prefs.shiftNotes}
                    onChange={(e) => setPrefs((prev) => ({ ...prev, shiftNotes: e.target.value }))}
                    className="form-input"
                  />
                </div>

                <div className="form-actions-bar">
                  <button type="submit" disabled={isSavingProfile} className="primary-save-btn">
                    {isSavingProfile ? "Saving Profile Changes..." : "Save Profile & Contact Details"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}

          {/* TAB 2: PASSWORD CHANGE */}
          {activeTab === "PASSWORD" && (
            <form onSubmit={handleChangePassword} method="POST" action="/api/v1/auth/staff/me" className="settings-card" noValidate>
              <fieldset className="settings-fieldset">
                <legend className="fieldset-legend">Change Staff Password (Argon2id)</legend>
                <p className="fieldset-desc">
                  Your password is hashed using memory-hard Argon2id parameters. Changing your password automatically revokes other stale browser sessions.
                </p>

                <div className="password-form-stack">
                  <div className="form-group">
                    <label htmlFor="current-password" className="form-label">
                      Current Password
                    </label>
                    <div className="password-input-wrap">
                      <input
                        id="current-password"
                        name="old_password"
                        type={showOldPass ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={oldPassword}
                        onChange={(e) => {
                          setOldPassword(e.target.value);
                          if (passwordErrors.oldPassword) {
                            setPasswordErrors((prev) => ({ ...prev, oldPassword: "" }));
                          }
                        }}
                        onBlur={(e) => validatePasswordField("oldPassword", e.target.value)}
                        aria-describedby="current-password-help"
                        className="form-input"
                      />
                      <button
                        type="button"
                        aria-pressed={showOldPass}
                        aria-label={showOldPass ? "Hide current password" : "Show current password"}
                        onClick={() => setShowOldPass((v) => !v)}
                        className="pass-toggle-btn"
                      >
                        {showOldPass ? "Hide" : "Show"}
                      </button>
                    </div>
                    <div id="current-password-help" className="form-help">
                      {passwordErrors.oldPassword && (
                        <span className="err-text">{passwordErrors.oldPassword}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="new-password" className="form-label">
                      New Password
                    </label>
                    <div className="password-input-wrap">
                      <input
                        id="new-password"
                        name="new_password"
                        type={showNewPass ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (passwordErrors.newPassword) {
                            setPasswordErrors((prev) => ({ ...prev, newPassword: "" }));
                          }
                        }}
                        onBlur={(e) => validatePasswordField("newPassword", e.target.value)}
                        aria-describedby="new-password-constraints"
                        className="form-input"
                      />
                      <button
                        type="button"
                        aria-pressed={showNewPass}
                        aria-label={showNewPass ? "Hide new password" : "Show new password"}
                        onClick={() => setShowNewPass((v) => !v)}
                        className="pass-toggle-btn"
                      >
                        {showNewPass ? "Hide" : "Show"}
                      </button>
                    </div>

                    <div className="strength-bars" aria-hidden="true">
                      {[1, 2, 3, 4].map((idx) => (
                        <div
                          key={idx}
                          className={`strength-bar ${
                            passwordStrength >= idx
                              ? passwordStrength <= 2
                                ? "weak"
                                : passwordStrength === 3
                                ? "good"
                                : "strong"
                              : ""
                          }`}
                        />
                      ))}
                    </div>

                    <div id="new-password-constraints" className="form-help">
                      {passwordErrors.newPassword ? (
                        <span className="err-text">{passwordErrors.newPassword}</span>
                      ) : (
                        "Must be at least 8 characters. Mix uppercase, lowercase, numbers, and symbols for maximum strength."
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirm-password" className="form-label">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-password"
                      name="confirm_password"
                      type={showNewPass ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (passwordErrors.confirmPassword) {
                          setPasswordErrors((prev) => ({ ...prev, confirmPassword: "" }));
                        }
                      }}
                      onBlur={(e) => validatePasswordField("confirmPassword", e.target.value)}
                      aria-describedby="confirm-password-help"
                      className="form-input"
                    />
                    <div id="confirm-password-help" className="form-help">
                      {passwordErrors.confirmPassword && (
                        <span className="err-text">{passwordErrors.confirmPassword}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-actions-bar">
                  <button type="submit" disabled={isSavingPassword} className="primary-save-btn">
                    {isSavingPassword ? "Updating Password..." : "Update Staff Password"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}

          {/* TAB 3: 2FA AUTHENTICATOR SETUP */}
          {activeTab === "TWO_FACTOR" && (
            <div className="settings-card">
              <div className="totp-header-row">
                <div>
                  <h2 className="fieldset-legend" style={{ marginBottom: "6px" }}>
                    Two-Factor Authentication (TOTP 2FA)
                  </h2>
                  <p className="fieldset-desc" style={{ margin: 0 }}>
                    Protect your staff backoffice account with a time-based 6-digit one-time passcode from Google Authenticator, Authy, or 1Password.
                  </p>
                </div>

                <div className={`totp-status-badge ${profile?.totp_enabled ? "enabled" : "disabled"}`}>
                  {profile?.totp_enabled ? "● 2FA ENABLED" : "○ 2FA NOT ENABLED"}
                </div>
              </div>

              {totpError && (
                <div role="alert" className="totp-alert-error">
                  {totpError}
                </div>
              )}

              {!totpSecret ? (
                <div className="totp-action-panel">
                  <div className="totp-info-box">
                    <div style={{ fontSize: "28px" }}>📱</div>
                    <div>
                      <div style={{ fontWeight: 800, color: "#f8fafc", fontSize: "14px" }}>
                        {profile?.totp_enabled
                          ? "Your account is protected with 2FA TOTP."
                          : "Set up an Authenticator App in 60 seconds"}
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: "12.5px", marginTop: "4px" }}>
                        {profile?.totp_enabled
                          ? "You can rotate your secret key to move to a new phone, or disable 2FA below using your password."
                          : "Click the button below to generate your unique encrypted TOTP secret key and QR code."}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isTotpBusy}
                    onClick={handleStartTotpEnrollment}
                    className="primary-save-btn"
                  >
                    {isTotpBusy
                      ? "Generating Secret Key..."
                      : profile?.totp_enabled
                      ? "🔄 Rotate / Re-Enroll 2FA Authenticator"
                      : "🛡️ Generate 2FA Secret & QR Code"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleConfirmTotp} method="POST" action="/api/v1/auth/staff/me" className="totp-wizard-box" noValidate>
                  <fieldset className="settings-fieldset">
                    <legend className="fieldset-legend">Step 1: Scan QR Code or Enter Secret Key</legend>

                    <div className="totp-qr-grid">
                      <div className="qr-frame">
                        {totpUri && (
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                              totpUri
                            )}`}
                            alt="2FA TOTP QR Code for Authenticator App"
                            width={180}
                            height={180}
                            style={{ borderRadius: "8px", display: "block" }}
                          />
                        )}
                      </div>

                      <div className="totp-manual-col">
                        <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.5 }}>
                          1. Open <strong>Google Authenticator</strong>, <strong>Authy</strong>, or <strong>Microsoft Authenticator</strong> on your phone.
                          <br />
                          2. Scan the QR code on the left, or manually enter this Base32 Secret Key:
                        </div>

                        <div className="secret-key-box">
                          <code className="secret-code">{totpSecret}</code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(totpSecret);
                              addToast({
                                title: "Secret Key Copied",
                                description: "Paste this key into your authenticator app.",
                                variant: "info",
                              });
                            }}
                            className="copy-secret-btn"
                          >
                            Copy Key
                          </button>
                        </div>

                        <div className="form-group" style={{ marginTop: "12px" }}>
                          <label htmlFor="verify-totp-code" className="form-label">
                            Step 2: Enter 6-Digit Code from Authenticator App
                          </label>
                          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              id="verify-totp-code"
                              name="totp_code"
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              pattern="\d{6}"
                              maxLength={6}
                              required
                              placeholder="123456"
                              value={totpCode}
                              onChange={(e) => {
                                setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                                setTotpError(null);
                              }}
                              className="form-input mono-input totp-pin-input"
                            />
                            <button type="submit" disabled={isTotpBusy} className="primary-save-btn">
                              {isTotpBusy ? "Verifying..." : "Verify & Activate 2FA"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTotpSecret(null);
                                setTotpUri(null);
                                setTotpError(null);
                              }}
                              className="secondary-cancel-btn"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </fieldset>
                </form>
              )}

              {profile?.totp_enabled && (
                <form
                  onSubmit={handleDisableTotp}
                  method="POST"
                  action="/api/v1/auth/staff/me"
                  className="disable-totp-box"
                  noValidate
                >
                  <fieldset className="settings-fieldset">
                    <legend className="fieldset-legend" style={{ color: "#fca5a5", fontSize: "14px" }}>
                      Disable Two-Factor Authentication
                    </legend>
                    <p className="fieldset-desc" style={{ marginBottom: "12px" }}>
                      Confirm your current staff password to turn off 2FA requirement on your account.
                    </p>
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                      <div className="form-group" style={{ flex: 1, minWidth: "240px" }}>
                        <label htmlFor="disable-totp-pass" className="form-label">
                          Current Password
                        </label>
                        <input
                          id="disable-totp-pass"
                          name="password"
                          type="password"
                          required
                          autoComplete="current-password"
                          value={disablePassword}
                          onChange={(e) => {
                            setDisablePassword(e.target.value);
                            setTotpError(null);
                          }}
                          className="form-input"
                        />
                      </div>
                      <button type="submit" disabled={isTotpBusy} className="danger-btn">
                        {isTotpBusy ? "Disabling..." : "Disable 2FA"}
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: GOOGLE SIGN-IN & OAUTH INTEGRATION */}
          {activeTab === "GOOGLE_AUTH" && (
            <form onSubmit={handleSaveGoogleAuth} className="settings-card" noValidate>
              <fieldset className="settings-fieldset">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
                  <div>
                    <legend className="fieldset-legend">Google Sign-In & OAuth 2.0 Settings</legend>
                    <p className="fieldset-desc" style={{ margin: "4px 0 0" }}>
                      Enable seamless 1-click Google Sign-In for customers and staff across web and mobile.
                    </p>
                  </div>

                  <label style={{ display: "inline-flex", alignItems: "center", gap: "10px", cursor: "pointer", background: "rgba(2, 6, 23, 0.6)", padding: "8px 16px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.12)" }}>
                    <input
                      type="checkbox"
                      checked={googleEnabled}
                      onChange={(e) => setGoogleEnabled(e.target.checked)}
                      style={{ width: "20px", height: "20px", accentColor: "#2563eb", cursor: "pointer" }}
                    />
                    <span style={{ fontWeight: 800, fontSize: "13px", color: googleEnabled ? "#38bdf8" : "#94a3b8" }}>
                      {googleEnabled ? "GOOGLE SIGN-IN: ACTIVE" : "GOOGLE SIGN-IN: DISABLED"}
                    </span>
                  </label>
                </div>

                {isLoadingGoogle ? (
                  <p style={{ color: "#94a3b8" }}>Loading Google OAuth configuration...</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div className="form-group">
                      <label htmlFor="google-client-id" className="form-label">
                        Google Client ID (Web Application)
                      </label>
                      <input
                        id="google-client-id"
                        name="client_id"
                        type="text"
                        placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                        value={googleClientId}
                        onChange={(e) => setGoogleClientId(e.target.value)}
                        className="form-input mono-input"
                      />
                      <div className="form-help">
                        Found in Google Cloud Console &gt; APIs & Services &gt; Credentials.
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="google-client-secret" className="form-label">
                        Google Client Secret {hasSecret && <span style={{ color: "#34d399", fontSize: "11px" }}>● (Configured: {googleSecretMasked})</span>}
                      </label>
                      <input
                        id="google-client-secret"
                        name="client_secret"
                        type="password"
                        placeholder={hasSecret ? "Enter new secret only if updating..." : "GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"}
                        value={googleClientSecret}
                        onChange={(e) => setGoogleClientSecret(e.target.value)}
                        className="form-input mono-input"
                      />
                      <div className="form-help">
                        Never exposed to frontend clients. Stored securely in database settings.
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">
                          Authorized JavaScript Origin
                        </label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type="text"
                            readOnly
                            value={typeof window !== "undefined" ? window.location.origin : "https://ncamart.com"}
                            className="form-input mono-input"
                            style={{ backgroundColor: "rgba(255, 255, 255, 0.04)", color: "#94a3b8" }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(typeof window !== "undefined" ? window.location.origin : "https://ncamart.com");
                              addToast({ title: "Origin Copied", description: "Paste into Google Cloud Console Authorized Origins.", variant: "info" });
                            }}
                            className="copy-secret-btn"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="google-redirect-uri" className="form-label">
                          Authorized Redirect URI
                        </label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            id="google-redirect-uri"
                            name="redirect_uri"
                            type="text"
                            value={googleRedirectUri}
                            onChange={(e) => setGoogleRedirectUri(e.target.value)}
                            className="form-input mono-input"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(googleRedirectUri);
                              addToast({ title: "URI Copied", description: "Paste into Google Cloud Console Authorized Redirect URIs.", variant: "info" });
                            }}
                            className="copy-secret-btn"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Step-by-Step Google Setup Guide Box */}
                    <div style={{ marginTop: "12px", padding: "16px 20px", borderRadius: "12px", backgroundColor: "rgba(2, 6, 23, 0.65)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                      <div style={{ fontWeight: 800, color: "#38bdf8", fontSize: "13.5px", marginBottom: "8px" }}>
                        📘 Quick 3-Minute Google Cloud Console Setup:
                      </div>
                      <ol style={{ margin: 0, paddingLeft: "18px", color: "#cbd5e1", fontSize: "12.5px", lineHeight: 1.7 }}>
                        <li>Visit <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ color: "#f59e0b", textDecoration: "underline" }}>Google Cloud Console &gt; Credentials</a> and create/select a project.</li>
                        <li>Configure the <strong>OAuth Consent Screen</strong> (App Name: &quot;NCAMart&quot;, User support email).</li>
                        <li>Click <strong>Create Credentials &gt; OAuth client ID</strong>, choose <strong>Web application</strong>.</li>
                        <li>Add your domain to <strong>Authorized JavaScript origins</strong> (e.g. <code>https://ncamart.com</code>).</li>
                        <li>Add the Redirect URI to <strong>Authorized redirect URIs</strong> (e.g. <code>https://ncamart.com/api/v1/auth/google/callback</code>).</li>
                        <li>Copy the generated <strong>Client ID</strong> & <strong>Client Secret</strong> into the fields above and click <strong>Save Google Configuration</strong> below!</li>
                      </ol>
                    </div>

                    <div className="form-actions-bar">
                      <button type="submit" disabled={isSavingGoogle} className="primary-save-btn">
                        {isSavingGoogle ? "Saving Google Configuration..." : "Save Google OAuth Configuration"}
                      </button>
                    </div>
                  </div>
                )}
              </fieldset>
            </form>
          )}

          {/* TAB 5: WORKSPACE PREFERENCES & ACTIVE SESSIONS */}
          {activeTab === "PREFERENCES" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <form onSubmit={handleSavePreferences} method="POST" action="/api/v1/auth/staff/me" className="settings-card">
                <fieldset className="settings-fieldset">
                  <legend className="fieldset-legend">Workspace & Hardware Preferences</legend>
                  <p className="fieldset-desc">
                    Customize your default landing console, thermal label printer format, and notification behavior.
                  </p>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label htmlFor="pref-console" className="form-label">
                        Default Post-Login Console
                      </label>
                      <select
                        id="pref-console"
                        name="default_console"
                        value={prefs.defaultConsole}
                        onChange={(e) =>
                          setPrefs((prev) => ({
                            ...prev,
                            defaultConsole: e.target.value as "/admin" | "/pos" | "/runner",
                          }))
                        }
                        className="form-input"
                      >
                        <option value="/admin">👑 Admin Backoffice (/admin)</option>
                        <option value="/pos">🖥️ Showroom Counter POS (/pos)</option>
                        <option value="/runner">🏃 Field Runner PWA (/runner)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="pref-printer" className="form-label">
                        Thermal / Label Printer Format
                      </label>
                      <select
                        id="pref-printer"
                        name="printer_format"
                        value={prefs.printerFormat}
                        onChange={(e) =>
                          setPrefs((prev) => ({
                            ...prev,
                            printerFormat: e.target.value as StaffPreferences["printerFormat"],
                          }))
                        }
                        className="form-input"
                      >
                        <option value="80MM_POS">🧾 80mm Thermal POS Receipt</option>
                        <option value="50X25_SEAL">🏷️ 50×25mm Holographic QC Seal</option>
                        <option value="A4_INVOICE">📄 A4 Mushak 6.3 VAT Invoice</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="pref-idle" className="form-label">
                        Idle Session Auto-Lock Timer
                      </label>
                      <select
                        id="pref-idle"
                        name="idle_lock_minutes"
                        value={prefs.idleLockMinutes}
                        onChange={(e) =>
                          setPrefs((prev) => ({
                            ...prev,
                            idleLockMinutes: e.target.value as StaffPreferences["idleLockMinutes"],
                          }))
                        }
                        className="form-input"
                      >
                        <option value="15">15 Minutes (High Security)</option>
                        <option value="30">30 Minutes</option>
                        <option value="60">1 Hour (Recommended)</option>
                        <option value="720">12 Hours (Full Shift)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="pref-lang" className="form-label">
                        Backoffice Interface Language
                      </label>
                      <select
                        id="pref-lang"
                        name="language"
                        value={prefs.language}
                        onChange={(e) =>
                          setPrefs((prev) => ({ ...prev, language: e.target.value as "en" | "bn" }))
                        }
                        className="form-input"
                      >
                        <option value="en">English (Default Operations)</option>
                        <option value="bn">বাংলা (Bengali)</option>
                      </select>
                    </div>
                  </div>

                  <div className="checkbox-row-list">
                    <label className="checkbox-card">
                      <input
                        type="checkbox"
                        name="sound_alerts"
                        checked={prefs.soundAlerts}
                        onChange={(e) => setPrefs((prev) => ({ ...prev, soundAlerts: e.target.checked }))}
                      />
                      <div>
                        <div className="cb-title">🔔 Play Audio Chime on New Order / Runner Alert</div>
                        <div className="cb-sub">
                          Sounds an audible chime when a new order or QC inspection task enters the queue.
                        </div>
                      </div>
                    </label>

                    <label className="checkbox-card">
                      <input
                        type="checkbox"
                        name="compact_tables"
                        checked={prefs.compactTables}
                        onChange={(e) => setPrefs((prev) => ({ ...prev, compactTables: e.target.checked }))}
                      />
                      <div>
                        <div className="cb-title">📊 High-Density Data Tables</div>
                        <div className="cb-sub">
                          Reduces row padding in SKU catalog, ledger, and order pipelines to show more rows per screen.
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="form-actions-bar">
                    <button type="submit" disabled={isSavingPrefs} className="primary-save-btn">
                      {isSavingPrefs ? "Saving..." : "Save Workspace Preferences"}
                    </button>
                  </div>
                </fieldset>
              </form>

              <div className="settings-card">
                <div className="totp-header-row" style={{ marginBottom: "14px" }}>
                  <div>
                    <h2 className="fieldset-legend" style={{ marginBottom: "4px" }}>
                      Active Staff Sessions (12-Hour Absolute TTL)
                    </h2>
                    <p className="fieldset-desc" style={{ margin: 0 }}>
                      Devices currently signed in to your staff account. Revoke unfamiliar sessions immediately.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isRevokingSessions}
                    onClick={handleRevokeOtherSessions}
                    className="danger-btn"
                  >
                    {isRevokingSessions ? "Revoking..." : "Revoke All Other Sessions"}
                  </button>
                </div>

                <div className="sessions-list">
                  {sessions.length === 0 ? (
                    <div className="session-item">
                      <div>
                        <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "13px" }}>
                          🖥️ Current Browser Session{" "}
                          <span className="current-session-pill">THIS DEVICE</span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "2px" }}>
                          Active authenticated session • 12-hour hardware token TTL
                        </div>
                      </div>
                    </div>
                  ) : (
                    sessions.map((sess) => (
                      <div key={sess.id} className="session-item">
                        <div>
                          <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "13px" }}>
                            🖥️ {sess.user_agent.slice(0, 72)}{" "}
                            {sess.is_current && (
                              <span className="current-session-pill">THIS DEVICE</span>
                            )}
                          </div>
                          <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "3px" }}>
                            IP: <code>{sess.ip}</code> • Last active:{" "}
                            {new Date(sess.last_seen_at).toLocaleString()} • Expires:{" "}
                            {new Date(sess.expires_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .staff-settings-container {
          padding: 24px;
          max-width: 1120px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .settings-hero-card {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 22px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .hero-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .avatar-badge {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #0b0f19;
          font-size: 22px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 18px rgba(245, 158, 11, 0.3);
          flex-shrink: 0;
        }

        .hero-name-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .hero-title {
          font-size: 20px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0;
        }

        .status-pill {
          font-size: 11px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 999px;
        }

        .status-pill.totp-on {
          background: rgba(16, 185, 129, 0.16);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }

        .status-pill.totp-off {
          background: rgba(245, 158, 11, 0.16);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }

        .hero-subtitle {
          font-size: 12.5px;
          color: #94a3b8;
          margin: 4px 0 8px;
        }

        .role-chips-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .role-chip {
          font-size: 10px;
          font-weight: 800;
          font-family: monospace;
          background: rgba(56, 189, 248, 0.14);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
          padding: 2px 8px;
          border-radius: 6px;
        }

        .security-score-box {
          background: rgba(2, 6, 23, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px 16px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .score-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
          font-weight: 700;
        }

        .score-val {
          font-size: 12.5px;
          font-weight: 800;
          color: #f8fafc;
        }

        .settings-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 10px;
        }

        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab-btn:hover {
          color: #f8fafc;
          background: rgba(30, 41, 59, 0.9);
        }

        .tab-btn.active {
          background: rgba(245, 158, 11, 0.16);
          border-color: #f59e0b;
          color: #fbbf24;
        }

        .settings-card {
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 16px;
          padding: 24px;
        }

        .settings-fieldset {
          border: none;
          padding: 0;
          margin: 0;
        }

        .fieldset-legend {
          font-size: 17px;
          font-weight: 800;
          color: #f8fafc;
          margin-bottom: 6px;
        }

        .fieldset-desc {
          font-size: 13px;
          color: #94a3b8;
          margin: 0 0 20px;
          line-height: 1.5;
        }

        .form-grid-2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
          gap: 18px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-label {
          font-size: 12.5px;
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 6px;
        }

        .form-input {
          font-size: 1rem;
          min-height: 46px;
          padding: 10px 14px;
          border-radius: 10px;
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: #f8fafc;
          box-sizing: border-box;
          width: 100%;
        }

        .form-input:focus {
          outline: 2px solid #f59e0b;
          border-color: transparent;
        }

        .mono-input {
          font-family: monospace;
        }

        .form-help {
          font-size: 11.5px;
          color: #64748b;
          margin-top: 5px;
          min-height: 16px;
        }

        .err-text {
          color: #f87171;
          font-weight: 600;
        }

        .form-actions-bar {
          margin-top: 22px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: flex-end;
        }

        .primary-save-btn {
          min-height: 44px;
          padding: 10px 20px;
          border-radius: 10px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #0b0f19;
          font-weight: 800;
          font-size: 13.5px;
          border: none;
          cursor: pointer;
        }

        .primary-save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondary-cancel-btn {
          min-height: 44px;
          padding: 10px 16px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #cbd5e1;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }

        .danger-btn {
          min-height: 44px;
          padding: 10px 16px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.16);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }

        .password-form-stack {
          max-width: 520px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .password-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .pass-toggle-btn {
          position: absolute;
          right: 10px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
        }

        .strength-bars {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-top: 8px;
        }

        .strength-bar {
          height: 5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
        }

        .strength-bar.weak {
          background: #ef4444;
        }

        .strength-bar.good {
          background: #f59e0b;
        }

        .strength-bar.strong {
          background: #10b981;
        }

        .totp-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .totp-status-badge {
          font-size: 11.5px;
          font-weight: 800;
          padding: 6px 12px;
          border-radius: 999px;
          font-family: monospace;
        }

        .totp-status-badge.enabled {
          background: rgba(16, 185, 129, 0.16);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }

        .totp-status-badge.disabled {
          background: rgba(245, 158, 11, 0.16);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }

        .totp-alert-error {
          margin-top: 14px;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.14);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          font-size: 13px;
          font-weight: 600;
        }

        .totp-action-panel {
          margin-top: 20px;
          padding: 20px;
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .totp-info-box {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .totp-wizard-box {
          margin-top: 20px;
          padding: 20px;
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.65);
          border: 1px solid rgba(245, 158, 11, 0.35);
        }

        .totp-qr-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 24px;
          align-items: center;
          margin-top: 12px;
        }

        .qr-frame {
          background: #ffffff;
          padding: 12px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .secret-key-box {
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 8px 14px;
          border-radius: 8px;
        }

        .secret-code {
          font-family: monospace;
          font-size: 14px;
          font-weight: 800;
          color: #fbbf24;
          letter-spacing: 0.08em;
        }

        .copy-secret-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #f8fafc;
          font-size: 11px;
          font-weight: 700;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
        }

        .totp-pin-input {
          max-width: 180px;
          font-size: 18px;
          letter-spacing: 0.25em;
          text-align: center;
          font-weight: 800;
        }

        .disable-totp-box {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .checkbox-row-list {
          margin-top: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .checkbox-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(2, 6, 23, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
        }

        .checkbox-card input[type="checkbox"] {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          accent-color: #f59e0b;
        }

        .cb-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #f8fafc;
        }

        .cb-sub {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .session-item {
          padding: 14px 16px;
          border-radius: 10px;
          background: rgba(2, 6, 23, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .current-session-pill {
          margin-left: 8px;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.18);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }

        @media (max-width: 680px) {
          .totp-qr-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
