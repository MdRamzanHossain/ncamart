import type { AdminRole } from "../types";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: AdminRole[];
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  twoFactorEnabled: boolean;
  assignedLocation: string;
  createdAt: string;
  lastLoginAt: string;
}

export type AuditActionType =
  | "PRICE_OVERRIDE"
  | "SEAL_VOID"
  | "REFUND_ISSUED"
  | "CUSTOMER_ANONYMIZED"
  | "STAFF_ROLE_MUTATED"
  | "TOTP_2FA_RESET";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: AdminRole;
  action: AuditActionType;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  beforeJson: Record<string, unknown>;
  afterJson: Record<string, unknown>;
}

export type RetentionStatus = "ACTIVE_RETENTION" | "ELIGIBLE_FOR_PURGE" | "ANONYMIZED";

export interface CustomerPiiRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  division: string;
  city: string;
  totalOrders: number;
  registeredAt: string;
  retentionStatus: RetentionStatus;
  ledgerBalancePaisa: number;
  journalEntriesCount: number;
}
