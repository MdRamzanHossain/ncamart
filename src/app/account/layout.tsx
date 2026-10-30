import React from "react";
import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";

export const metadata: Metadata = {
  title: "Customer Account | NCAMart Nawabpur Complex",
  description: "Manage orders, store credit wallet, address book, warranties, and account security.",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountShell>
      {children}
    </AccountShell>
  );
}
