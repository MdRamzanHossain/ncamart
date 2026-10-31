import type { Metadata } from "next";
import { SecurityGovernanceView } from "@/components/admin/security/SecurityGovernanceView";

export const metadata: Metadata = {
  title: "Registered Users & Staff Access Control | NCAMart Admin",
  description:
    "Monitor registered users, manage access roles, promote/demote staff, reset 2FA, and manage account lifecycle.",
};

export default function AdminUsersPage() {
  return <SecurityGovernanceView initialTab="STAFF_RBAC" />;
}

