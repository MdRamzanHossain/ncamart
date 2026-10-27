import type { Metadata } from "next";
import { SecurityGovernanceView } from "@/components/admin/security/SecurityGovernanceView";

export const metadata: Metadata = {
  title: "Staff RBAC, Audit Logs & Privacy Console | NCAMart Admin",
  description:
    "Granular staff permissions, immutable state audit trail, and customer PII anonymization retention governance.",
};

export default function AdminSecurityPage() {
  return <SecurityGovernanceView />;
}
