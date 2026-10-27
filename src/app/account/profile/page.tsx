import React from "react";
import type { Metadata } from "next";
import { ProfileAndSecurityView } from "@/components/account/ProfileAndSecurityView";
import type { CustomerProfile, DeviceSession } from "@/components/account/types";

export const metadata: Metadata = {
  title: "Profile & Security | NCAMart",
  description: "Manage your name, verified phone number, active device sessions, and login security.",
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

const mockSessions: DeviceSession[] = [
  {
    id: "sess_01",
    deviceType: "DESKTOP",
    browser: "Chrome 130",
    os: "Windows 11",
    ipAddress: "103.148.14.22",
    location: "Dhaka, Bangladesh",
    lastActiveAt: new Date().toISOString(),
    isCurrentSession: true,
  },
  {
    id: "sess_02",
    deviceType: "MOBILE",
    browser: "Mobile Safari 18",
    os: "iOS 18 (iPhone 16 Pro)",
    ipAddress: "118.179.88.10",
    location: "Nawabpur, Dhaka",
    lastActiveAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    isCurrentSession: false,
  },
  {
    id: "sess_03",
    deviceType: "MOBILE",
    browser: "Chrome Mobile 130",
    os: "Android 15 (Samsung S24)",
    ipAddress: "103.205.180.5",
    location: "Chittagong, Bangladesh",
    lastActiveAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    isCurrentSession: false,
  },
];

export default function ProfileAndSecurityPage() {
  return (
    <ProfileAndSecurityView
      initialProfile={mockProfile}
      initialSessions={mockSessions}
    />
  );
}
