import type { Metadata } from "next";
import { StaffSettingsView } from "@/components/admin/settings/StaffSettingsView";

export const metadata: Metadata = {
  title: "Account & Security Settings | NCAMart Admin",
  description:
    "Manage your staff profile, mobile number, Argon2id password, 2FA TOTP authenticator, and active sessions.",
};

export default function AdminStaffSettingsPage() {
  return <StaffSettingsView />;
}

