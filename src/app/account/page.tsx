"use client";

import React, { useState, useEffect } from "react";
import { AccountDashboardView } from "@/components/account/AccountDashboardView";
import type { CustomerProfile } from "@/components/account/types";
import { useAuth } from "@/context/AuthContext";

export default function AccountDashboardPage() {
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

  const [walletBalancePaisa, setWalletBalancePaisa] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [preOrdersCount, setPreOrdersCount] = useState(0);
  const [activeWarrantiesCount, setActiveWarrantiesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadRealData() {
      try {
        // 1. Fetch real Customer Profile from DB
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

            if (typeof profileData.store_credit_balance_paisa === "number") {
              setWalletBalancePaisa(profileData.store_credit_balance_paisa);
            }
          }
        }

        // 2. Fetch real Orders from DB
        const ordersRes = await fetch("/api/v1/orders?limit=50");
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          if (isMounted && ordersData && Array.isArray(ordersData.items)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const active = ordersData.items.filter((o: any) => o.status !== "DELIVERED" && o.status !== "CANCELLED");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pre = ordersData.items.filter((o: any) => o.order_type === "PRE_ORDER");
            setActiveOrdersCount(active.length);
            setPreOrdersCount(pre.length);
          }
        }

        // 3. Fetch real Warranties from DB
        const warRes = await fetch("/api/v1/customer/warranties");
        if (warRes.ok) {
          const warData = await warRes.json();
          if (isMounted && Array.isArray(warData)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const activeW = warData.filter((w: any) => w.status === "ACTIVE");
            setActiveWarrantiesCount(activeW.length);
          }
        }
      } catch {
        // Safe fallback to zero state if offline
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRealData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
        <p>Loading your account dashboard...</p>
      </div>
    );
  }

  return (
    <AccountDashboardView
      profile={profile}
      walletBalancePaisa={walletBalancePaisa}
      activeOrdersCount={activeOrdersCount}
      preOrdersCount={preOrdersCount}
      activeWarrantiesCount={activeWarrantiesCount}
    />
  );
}
