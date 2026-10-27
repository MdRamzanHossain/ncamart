import React from "react";
import type { Metadata } from "next";
import { AccountDashboardView } from "@/components/account/AccountDashboardView";
import type { CustomerProfile } from "@/components/account/types";

export const metadata: Metadata = {
  title: "Account Dashboard | NCAMart",
  description: "Overview of your orders, store credit balance, warranties, and rapid support.",
};

const mockProfile: CustomerProfile = {
  id: "cust_demo_01",
  name: "Engr. Tanvir Ahmed",
  phone: "+880 1712-345678",
  email: "tanvir.engr@example.com",
  tier: "PRO_ENGINEER",
  joinedAt: "2026-01-15T00:00:00.000Z",
  isPhoneVerified: true,
};

export default function AccountDashboardPage() {
  return (
    <AccountDashboardView
      profile={mockProfile}
      walletBalancePaisa={485000} // ৳4,850.00
      activeOrdersCount={2}
      preOrdersCount={1}
      activeWarrantiesCount={1}
    />
  );
}
