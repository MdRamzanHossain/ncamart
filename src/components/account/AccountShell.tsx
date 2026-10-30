"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccountSidebar } from "./AccountSidebar";
import type { CustomerProfile } from "./types";
import { useAuth } from "@/context/AuthContext";

interface AccountShellProps {
  profile?: CustomerProfile;
  walletBalancePaisa?: number;
  activeOrdersCount?: number;
  activeWarrantiesCount?: number;
  children: React.ReactNode;
}

export function AccountShell({
  profile: initialProfile,
  walletBalancePaisa: initialWalletBalance = 0,
  activeOrdersCount: initialOrdersCount = 0,
  activeWarrantiesCount: initialWarrantiesCount = 0,
  children,
}: AccountShellProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [liveProfile, setLiveProfile] = useState<CustomerProfile>(() => {
    return (
      initialProfile || {
        id: user?.id || "cust_loading",
        name: user?.name || user?.email || "Valued Customer",
        phone: user?.phone || "+880 1...",
        email: user?.email || null,
        tier: "REGULAR",
        joinedAt: new Date().toISOString(),
        isPhoneVerified: Boolean(user?.phone),
      }
    );
  });

  const [walletBalance, setWalletBalance] = useState<number>(initialWalletBalance);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(initialOrdersCount);
  const [activeWarrantiesCount, setActiveWarrantiesCount] = useState<number>(initialWarrantiesCount);

  // Sync with real authenticated user and live database APIs
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login?redirect=/account");
      return;
    }

    if (user) {
      setLiveProfile((prev) => ({
        ...prev,
        id: user.id || prev.id,
        name: user.name || user.email?.split("@")[0] || prev.name,
        phone: user.phone || prev.phone,
        email: user.email || prev.email,
        isPhoneVerified: Boolean(user.phone),
      }));

      // Fetch real customer profile & store credit balance from DB
      fetch("/api/v1/customer/profile")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setLiveProfile((prev) => ({
              ...prev,
              id: data.id || prev.id,
              name: data.full_name || prev.name,
              phone: data.phone || prev.phone,
              email: data.email || prev.email,
              tier: data.cod_eligibility?.cod_allowed ? "PRO_ENGINEER" : "REGULAR",
              isPhoneVerified: Boolean(data.phone),
            }));

            if (typeof data.store_credit_balance_paisa === "number") {
              setWalletBalance(data.store_credit_balance_paisa);
            }
          }
        })
        .catch(() => {});

      // Fetch real orders count from DB
      fetch("/api/v1/orders?limit=50")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.items)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const active = data.items.filter((o: any) => o.status !== "DELIVERED" && o.status !== "CANCELLED");
            setActiveOrdersCount(active.length);
          }
        })
        .catch(() => {});

      // Fetch real warranties count from DB
      fetch("/api/v1/customer/warranties")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const activeW = data.filter((w: any) => w.status === "ACTIVE");
            setActiveWarrantiesCount(activeW.length);
          }
        })
        .catch(() => {});
    }
  }, [user, isAuthenticated, isLoading, router]);

  return (
    <div className="account-layout-wrapper">
      <div className="account-container">
        <aside className="account-sidebar-col">
          <AccountSidebar
            profile={liveProfile}
            walletBalancePaisa={walletBalance}
            activeOrdersCount={activeOrdersCount}
            activeWarrantiesCount={activeWarrantiesCount}
          />
        </aside>

        <main className="account-main-col">{children}</main>
      </div>

      <style jsx>{`
        .account-layout-wrapper {
          min-height: calc(100vh - 200px);
          padding: 2.5rem 1.5rem 5rem;
          background: radial-gradient(
            circle at top right,
            rgba(16, 185, 129, 0.03) 0%,
            transparent 60%
          );
        }

        .account-container {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 2.5rem;
          align-items: flex-start;
        }

        @media (max-width: 960px) {
          .account-container {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
        }

        .account-main-col {
          min-width: 0;
        }
      `}</style>
    </div>
  );
}
