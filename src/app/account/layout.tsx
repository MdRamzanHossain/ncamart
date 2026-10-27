import React from "react";
import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import type { CustomerProfile } from "@/components/account/types";

export const metadata: Metadata = {
  title: "Customer Account | NCAMart Nawabpur Complex",
  description: "Manage orders, store credit wallet, address book, warranties, and account security.",
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

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountShell
      profile={mockProfile}
      walletBalancePaisa={485000} // ৳4,850.00
      activeOrdersCount={2}
      activeWarrantiesCount={1}
    >
      {children}
    </AccountShell>
  );
}
