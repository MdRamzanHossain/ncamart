"use client";

import React, { useState } from "react";
import type { CustomerProfile, DeviceSession } from "./types";
import { useToast } from "@/components/ui/toast";

interface ProfileAndSecurityViewProps {
  initialProfile: CustomerProfile;
  initialSessions: DeviceSession[];
}

export function ProfileAndSecurityView({
  initialProfile,
  initialSessions,
}: ProfileAndSecurityViewProps) {
  const [profile, setProfile] = useState<CustomerProfile>(initialProfile);
  const [sessions, setSessions] = useState<DeviceSession[]>(initialSessions);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isTerminatingSessions, setIsTerminatingSessions] = useState(false);

  const { addToast } = useToast();

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    setTimeout(() => {
      setProfile((prev) => ({
        ...prev,
        name,
        email,
      }));
      setIsSavingProfile(false);
      addToast({
        title: "Profile Updated",
        description: "Your contact details have been successfully saved.",
        variant: "success",
      });
    }, 400);
  };

  const handleSignOutOtherDevices = () => {
    setIsTerminatingSessions(true);

    setTimeout(() => {
      // Keep only current session
      setSessions((prev) => prev.filter((s) => s.isCurrentSession));
      setIsTerminatingSessions(false);

      addToast({
        title: "Sessions Terminated",
        description: "You have been logged out from all other mobile and desktop devices.",
        variant: "success",
      });
    }, 600);
  };

  return (
    <div className="profile-security-container" role="region" aria-label="Profile and Security">
      {/* 1. Profile Information */}
      <section className="settings-card">
        <div className="card-header">
          <div>
            <h2>Personal Information</h2>
            <p>Your primary contact credentials for order delivery & verification.</p>
          </div>
          <span className="tier-tag">
            {profile.tier === "PRO_ENGINEER"
              ? "⚡ Pro Engineer Tier"
              : "⭐ Nawabpur Valued Member"}
          </span>
        </div>

        <form onSubmit={handleProfileSave} className="profile-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="customer-name" className="field-label">Full Name</label>
              <input
                id="customer-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Verified Mobile Number</label>
              <div className="phone-verified-wrap">
                <input
                  type="text"
                  value={profile.phone}
                  readOnly
                  className="read-only-input"
                  data-testid="profile-phone"
                />
                <span className="verified-badge-pill" data-testid="verified-phone-pill">
                  ✓ Verified +880
                </span>
              </div>
              <span className="helper-text">
                Mobile number serves as your primary OTP login identifier.
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="customer-email" className="field-label">Email Address (Optional)</label>
            <input
              id="customer-email"
              type="email"
              placeholder="e.g. rafiq@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <span className="helper-text">
              Used for official Mushak 6.3 Tax Invoice copies and warranty certificates.
            </span>
          </div>

          <div className="form-footer">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? "Saving Changes..." : "Save Profile Details"}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Active Device Sessions & Security */}
      <section className="settings-card">
        <div className="card-header">
          <div>
            <h2>Active Device Sessions</h2>
            <p>Manage browsers and mobile apps currently signed into your NCAMart account.</p>
          </div>
          {sessions.length > 1 && (
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={handleSignOutOtherDevices}
              disabled={isTerminatingSessions}
              data-testid="sign-out-other-devices-button"
            >
              {isTerminatingSessions ? "Terminating..." : "🚪 Sign Out Other Devices"}
            </button>
          )}
        </div>

        <div className="sessions-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.isCurrentSession ? "current-session" : ""}`}
              data-testid="session-item"
            >
              <div className="session-icon">
                {session.deviceType === "MOBILE"
                  ? "📱"
                  : session.deviceType === "TABLET"
                  ? "📟"
                  : "💻"}
              </div>

              <div className="session-info">
                <div className="session-title-row">
                  <span className="browser-os">
                    {session.browser} on {session.os}
                  </span>
                  {session.isCurrentSession && (
                    <span className="current-badge" data-testid="current-session-badge">
                      ✓ This Device (Active)
                    </span>
                  )}
                </div>

                <div className="session-meta">
                  <span>IP: {session.ipAddress}</span>
                  <span className="dot">•</span>
                  <span>{session.location}</span>
                  <span className="dot">•</span>
                  <span>
                    Last active:{" "}
                    {new Date(session.lastActiveAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .profile-security-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .settings-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 2rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        @media (max-width: 640px) {
          .settings-card {
            padding: 1.5rem;
          }
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          padding-bottom: 1.25rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        @media (max-width: 640px) {
          .card-header {
            flex-direction: column;
          }
        }

        .card-header h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.2rem;
        }

        .card-header p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .tier-tag {
          font-size: 0.75rem;
          font-weight: 700;
          color: #059669;
          background: #dcfce7;
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          white-space: nowrap;
        }

        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        @media (max-width: 640px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .field-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        input {
          padding: 0.625rem 0.875rem;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
        }

        .read-only-input {
          background: var(--color-surface-subtle, #f8fafc);
          color: var(--color-text-secondary);
          cursor: not-allowed;
          font-family: var(--font-mono, monospace);
        }

        .phone-verified-wrap {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .phone-verified-wrap input {
          flex: 1;
        }

        .verified-badge-pill {
          background: #dcfce7;
          color: #15803d;
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.35rem 0.625rem;
          border-radius: 9999px;
          white-space: nowrap;
        }

        .helper-text {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .form-footer {
          margin-top: 0.5rem;
        }

        /* ---------------------------------------------------- */
        /* SESSIONS LIST */
        /* ---------------------------------------------------- */
        .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .session-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--color-surface-subtle, #f8fafc);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: var(--radius-lg, 0.75rem);
        }

        .session-item.current-session {
          border-color: #059669;
          background: #f0fdf4;
        }

        .session-icon {
          font-size: 1.75rem;
          flex-shrink: 0;
        }

        .session-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .session-title-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .browser-os {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .current-badge {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #059669;
          background: #dcfce7;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }

        .session-meta {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }

        .dot {
          opacity: 0.5;
        }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: #059669;
          color: #ffffff;
          border: none;
        }

        .btn-primary:hover:not(:disabled) {
          background: #047857;
        }

        .btn-outline-danger {
          background: transparent;
          color: #dc2626;
          border: 1px solid #fca5a5;
          font-size: 0.8125rem;
          padding: 0.4rem 0.875rem;
        }

        .btn-outline-danger:hover:not(:disabled) {
          background: #fee2e2;
        }
      `}</style>
    </div>
  );
}
