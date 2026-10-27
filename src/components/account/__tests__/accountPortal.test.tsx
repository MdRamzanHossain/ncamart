import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ToastProvider } from "@/components/ui/toast";
import {
  AccountSidebar,
  StoreCreditWalletView,
  AddressBookView,
  ProfileAndSecurityView,
  AccountDashboardView,
  formatPaisaToBDT,
  type CustomerProfile,
  type StoreCreditWalletData,
  type CustomerAddress,
  type DeviceSession,
} from "../index";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/account/wallet",
  useSearchParams: () => new URLSearchParams(),
}));

const mockProfile: CustomerProfile = {
  id: "cust_01",
  name: "Engr. Tanvir Ahmed",
  phone: "+880 1712-345678",
  email: "tanvir.engr@example.com",
  tier: "PRO_ENGINEER",
  joinedAt: "2026-01-15T00:00:00.000Z",
  isPhoneVerified: true,
};

const mockWalletData: StoreCreditWalletData = {
  balancePaisa: 485000, // ৳4,850.00
  pendingWithdrawalPaisa: 0,
  transactions: [
    {
      id: "tx_01",
      amountPaisa: 285000,
      type: "REFUND_RMA",
      reference: "RMA-2026-0812",
      notes: "RMA Defect Resolution Credit",
      createdAt: "2026-10-25T16:20:00.000Z",
      balanceAfterPaisa: 485000,
    },
    {
      id: "tx_02",
      amountPaisa: -145000,
      type: "PURCHASE_DEBIT",
      reference: "ORD-99214",
      notes: "Store credit payment on checkout",
      createdAt: "2026-10-18T19:10:00.000Z",
      balanceAfterPaisa: 200000,
    },
  ],
};

const mockAddresses: CustomerAddress[] = [
  {
    id: "addr_01",
    label: "HOME",
    consigneeName: "Engr. Tanvir Ahmed",
    contactPhone: "+880 1712-345678",
    divisionId: "Dhaka",
    districtId: "dist_dhaka",
    districtName: "Dhaka",
    thanaId: "thana_dhanmondi",
    thanaName: "Dhanmondi",
    addressLine: "House #14, Road #5, Dhanmondi R/A",
    isDefault: true,
  },
  {
    id: "addr_02",
    label: "OFFICE",
    consigneeName: "Tanvir Ahmed (Robotics Lab)",
    contactPhone: "+880 1819-987654",
    divisionId: "Dhaka",
    districtId: "dist_dhaka",
    districtName: "Dhaka",
    thanaId: "thana_motijheel",
    thanaName: "Motijheel",
    addressLine: "Level 6, Tech Tower, Motijheel",
    isDefault: false,
  },
];

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
];

describe("Customer Account Portal & Store Credit Wallet — F22 Tests", () => {
  it("formats integer paisa correctly to BDT currency with ৳ symbol", () => {
    expect(formatPaisaToBDT(485000)).toMatch(/৳4,850\.00/);
    expect(formatPaisaToBDT(100)).toMatch(/৳1\.00/);
    expect(formatPaisaToBDT(0)).toMatch(/৳0\.00/);
  });

  describe("AccountSidebar Component", () => {
    it("renders customer identity, tier, verified badge, and quick wallet balance", () => {
      const html = renderToString(
        <AccountSidebar
          profile={mockProfile}
          walletBalancePaisa={485000}
          activeOrdersCount={2}
          activeWarrantiesCount={1}
        />
      );

      expect(html).toContain("Engr. Tanvir Ahmed");
      expect(html).toContain("+880 1712-345678");
      expect(html).toContain("Pro Engineer Tier");
      expect(html).toContain('data-testid="sidebar-wallet-balance"');
      expect(html).toMatch(/৳4,850\.00/);
    });

    it("renders all navigation items with active badge counters", () => {
      const html = renderToString(
        <AccountSidebar
          profile={mockProfile}
          walletBalancePaisa={485000}
          activeOrdersCount={2}
          activeWarrantiesCount={1}
        />
      );

      expect(html).toContain("Orders &amp; Delivery");
      expect(html).toMatch(/2.*Active/);
      expect(html).toContain("Store Credit Wallet");
      expect(html).toContain("Address Book");
      expect(html).toContain("Profile &amp; Security");
      expect(html).toContain("Sign Out");
    });
  });

  describe("StoreCreditWalletView Component", () => {
    it("renders large wallet balance card in BDT and payout CTA", () => {
      const html = renderToString(
        <ToastProvider>
          <StoreCreditWalletView initialData={mockWalletData} />
        </ToastProvider>
      );

      expect(html).toContain('data-testid="wallet-balance-amount"');
      expect(html).toMatch(/৳4,850\.00/);
      expect(html).toContain("Request Payout / Withdraw");
      expect(html).toContain("Segregated Escrow Ledger");
    });

    it("renders ledger transactions with references, types, amounts, and post-balances", () => {
      const html = renderToString(
        <ToastProvider>
          <StoreCreditWalletView initialData={mockWalletData} />
        </ToastProvider>
      );

      expect(html).toContain("Credit Ledger History");
      expect(html).toContain("RMA-2026-0812");
      expect(html).toContain("ORD-99214");
      expect(html).toMatch(/\+.*2,850\.00/);
      expect(html).toContain("1,450.00");
      expect(html).toContain("RMA Defect Resolution Credit");
    });
  });

  describe("AddressBookView Component", () => {
    it("renders saved delivery address cards with default badge", () => {
      const html = renderToString(
        <ToastProvider>
          <AddressBookView initialAddresses={mockAddresses} />
        </ToastProvider>
      );

      expect(html).toContain("Saved Delivery Addresses");
      expect(html).toContain("House #14, Road #5, Dhanmondi R/A");
      expect(html).toMatch(/Dhanmondi.*Dhaka/);
      expect(html).toContain('data-testid="default-badge"');
      expect(html).toContain("Default Shipping Address");
      expect(html).toContain('data-testid="add-address-button"');
    });
  });

  describe("ProfileAndSecurityView Component", () => {
    it("renders personal info with verified mobile number badge", () => {
      const html = renderToString(
        <ToastProvider>
          <ProfileAndSecurityView
            initialProfile={mockProfile}
            initialSessions={mockSessions}
          />
        </ToastProvider>
      );

      expect(html).toContain("Personal Information");
      expect(html).toContain("Engr. Tanvir Ahmed");
      expect(html).toContain('data-testid="verified-phone-pill"');
      expect(html).toContain("Verified +880");
    });

    it("renders active device sessions with current device indicator and sign out action", () => {
      const html = renderToString(
        <ToastProvider>
          <ProfileAndSecurityView
            initialProfile={mockProfile}
            initialSessions={mockSessions}
          />
        </ToastProvider>
      );

      expect(html).toContain("Active Device Sessions");
      expect(html).toMatch(/Chrome 130.*on.*Windows 11/);
      expect(html).toContain('data-testid="current-session-badge"');
      expect(html).toContain("This Device (Active)");
      expect(html).toContain('data-testid="sign-out-other-devices-button"');
      expect(html).toContain("Sign Out Other Devices");
    });
  });

  describe("AccountDashboardView Component", () => {
    it("renders welcome banner and 4 key metric cards", () => {
      const html = renderToString(
        <AccountDashboardView
          profile={mockProfile}
          walletBalancePaisa={485000}
          activeOrdersCount={2}
          preOrdersCount={1}
          activeWarrantiesCount={1}
        />
      );

      expect(html).toMatch(/Welcome back,.*Engr\. Tanvir Ahmed/);
      expect(html).toContain('data-testid="metric-active-orders"');
      expect(html).toMatch(/2.*In Transit/);
      expect(html).toContain('data-testid="metric-wallet-balance"');
      expect(html).toMatch(/৳4,850\.00/);
      expect(html).toContain('data-testid="metric-preorders"');
      expect(html).toMatch(/1.*Reserved/);
      expect(html).toContain('data-testid="metric-warranties"');
      expect(html).toMatch(/1.*Devices/);
      expect(html).toContain("Quick Shortcuts");
    });
  });
});
