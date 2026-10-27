"use client";

import React from "react";
import { AccountSidebar } from "./AccountSidebar";
import type { CustomerProfile } from "./types";

interface AccountShellProps {
  profile: CustomerProfile;
  walletBalancePaisa: number;
  activeOrdersCount?: number;
  activeWarrantiesCount?: number;
  children: React.ReactNode;
}

export function AccountShell({
  profile,
  walletBalancePaisa,
  activeOrdersCount = 2,
  activeWarrantiesCount = 1,
  children,
}: AccountShellProps) {
  return (
    <div className="account-layout-wrapper">
      <div className="account-container">
        <aside className="account-sidebar-col">
          <AccountSidebar
            profile={profile}
            walletBalancePaisa={walletBalancePaisa}
            activeOrdersCount={activeOrdersCount}
            activeWarrantiesCount={activeWarrantiesCount}
          />
        </aside>

        <main className="account-main-col">
          {children}
        </main>
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
