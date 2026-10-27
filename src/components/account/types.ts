export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  tier: "REGULAR" | "PRO_ENGINEER" | "CORPORATE";
  joinedAt: string;
  isPhoneVerified: boolean;
  avatarUrl?: string | null;
}

export interface CreditTransaction {
  id: string;
  amountPaisa: number;
  type: "REFUND_RMA" | "PREORDER_FORFEITURE_CREDIT" | "COMPENSATION" | "PURCHASE_DEBIT" | "WITHDRAWAL_PAYOUT";
  reference: string;
  notes?: string;
  createdAt: string;
  balanceAfterPaisa: number;
}

export interface StoreCreditWalletData {
  balancePaisa: number;
  pendingWithdrawalPaisa: number;
  transactions: CreditTransaction[];
}

export interface CustomerAddress {
  id: string;
  label: "HOME" | "OFFICE" | "OTHER";
  consigneeName: string;
  contactPhone: string;
  divisionId?: string;
  districtId: string;
  districtName: string;
  thanaId: string;
  thanaName: string;
  addressLine: string;
  isDefault: boolean;
}

export interface DeviceSession {
  id: string;
  deviceType: "DESKTOP" | "MOBILE" | "TABLET";
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
  lastActiveAt: string;
  isCurrentSession: boolean;
}

export function formatPaisaToBDT(paisa: number): string {
  const bdt = (paisa / 100).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `৳${bdt}`;
}
