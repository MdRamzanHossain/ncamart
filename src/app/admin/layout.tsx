import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Admin Operations Backoffice | NCAMart Nawabpur",
  description:
    "Executive operations hub, drop-and-pack runner task dispatch, godown QC seals, and double-entry ledger.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
