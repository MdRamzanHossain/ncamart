export type AuditActorType = "STAFF" | "SYSTEM" | "CUSTOMER";

export interface AuditEntryInput {
  staffId?: string | null;
  actorType: AuditActorType;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt?: Date;
}

export interface VerifyChainResult {
  valid: boolean;
  checkedCount: number;
  tamperedRowId?: bigint;
  error?: string;
}
