"use client";

import React, { useState, useEffect } from "react";
import { ProfileAndSecurityView } from "@/components/account/ProfileAndSecurityView";
import type { CustomerProfile, DeviceSession } from "@/components/account/types";
import { useAuth } from "@/context/AuthContext";

export default function ProfileAndSecurityPage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<CustomerProfile>({
    id: user?.id || "cust_user",
    name: user?.name || user?.email?.split("@")[0] || "Valued Customer",
    phone: user?.phone || "",
    email: user?.email || null,
    tier: "REGULAR",
    joinedAt: new Date().toISOString(),
    isPhoneVerified: Boolean(user?.phone),
  });

  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        // 1. Fetch real Customer Profile
        const profileRes = await fetch("/api/v1/customer/profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (isMounted && profileData) {
            setProfile({
              id: profileData.id || user?.id || "cust_user",
              name: profileData.full_name || user?.name || user?.email?.split("@")[0] || "Valued Customer",
              phone: profileData.phone || user?.phone || "",
              email: profileData.email || user?.email || null,
              tier: profileData.cod_eligibility?.cod_allowed ? "PRO_ENGINEER" : "REGULAR",
              joinedAt: profileData.created_at || new Date().toISOString(),
              isPhoneVerified: Boolean(profileData.phone),
            });
          }
        }

        // 2. Fetch real Customer Sessions
        const sessRes = await fetch("/api/v1/auth/sessions");
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (isMounted && Array.isArray(sessData)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mappedSessions: DeviceSession[] = sessData.map((s: any) => ({
              id: s.id,
              deviceType: s.user_agent?.toLowerCase().includes("mobi") ? "MOBILE" : "DESKTOP",
              browser: s.device_label || s.user_agent?.split(" ")[0] || "Web Browser",
              os: s.user_agent?.includes("Windows") ? "Windows" : s.user_agent?.includes("Mac") ? "macOS" : s.user_agent?.includes("Android") ? "Android" : "Mobile / Web",
              ipAddress: s.ip || "127.0.0.1",
              location: "Bangladesh",
              lastActiveAt: s.last_seen_at || s.created_at || new Date().toISOString(),
              isCurrentSession: Boolean(s.is_current),
            }));
            setSessions(mappedSessions);
          }
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>👤</div>
        <p>Loading your profile and security settings...</p>
      </div>
    );
  }

  return (
    <ProfileAndSecurityView
      initialProfile={profile}
      initialSessions={sessions}
    />
  );
}
