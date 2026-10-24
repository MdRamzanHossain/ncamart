import crypto from "node:crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import {
  sealRecords,
  sealEvents,
  qcRecords,
  sealVoidRequests,
  SealRecordRow,
  InsertSealRecordRow,
  SealEventRow,
  InsertSealEventRow,
  QcRecordRow,
  InsertQcRecordRow,
  SealVoidRequestRow,
  InsertSealVoidRequestRow,
} from "./schema";

// --------------------------------------------------------------------------
// In-Memory Fallback Stores for Offline / Testing Mode
// --------------------------------------------------------------------------
const memSeals = new Map<string, SealRecordRow>();
const memSealEvents: SealEventRow[] = [];
const memQcRecords = new Map<string, QcRecordRow>();
const memVoidRequests = new Map<string, SealVoidRequestRow>();

export function clearMemoryTrustForTesting(): void {
  memSeals.clear();
  memSealEvents.length = 0;
  memQcRecords.clear();
  memVoidRequests.clear();
}

export const trustRepo = {
  clearMemoryForTesting(): void {
    clearMemoryTrustForTesting();
  },

  // --------------------------------------------------------------------------
  // Seal Records
  // --------------------------------------------------------------------------
  async createSealRecord(
    row: InsertSealRecordRow,
    tx?: Tx
  ): Promise<SealRecordRow> {
    const client = tx ?? defaultDb;
    const fullRow: SealRecordRow = {
      id: row.id ?? crypto.randomUUID(),
      sealId: row.sealId,
      skuId: row.skuId,
      productTier: row.productTier,
      orderItemUnitId: row.orderItemUnitId ?? null,
      manufacturerSerial: row.manufacturerSerial ?? null,
      status: row.status ?? "GENERATED",
      technicianId: row.technicianId,
      warrantyDays: row.warrantyDays ?? 0,
      warrantyStart: row.warrantyStart ?? null,
      warrantyEnd: row.warrantyEnd ?? null,
      voidReason: row.voidReason ?? null,
      replacedBySealId: row.replacedBySealId ?? null,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };

    try {
      const [inserted] = await client.insert(sealRecords).values(fullRow).returning();
      if (inserted) {
        memSeals.set(inserted.id, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memSeals.set(fullRow.id, fullRow);
    return fullRow;
  },

  async getSealRecordById(id: string, tx?: Tx): Promise<SealRecordRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(sealRecords)
        .where(eq(sealRecords.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memSeals.get(id) ?? null;
  },

  async getSealRecordBySealId(sealId: string, tx?: Tx): Promise<SealRecordRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(sealRecords)
        .where(eq(sealRecords.sealId, sealId))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }

    for (const seal of memSeals.values()) {
      if (seal.sealId === sealId) return seal;
    }
    return null;
  },

  async getSealRecordByUnitId(unitId: string, tx?: Tx): Promise<SealRecordRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(sealRecords)
        .where(eq(sealRecords.orderItemUnitId, unitId))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }

    for (const seal of memSeals.values()) {
      if (seal.orderItemUnitId === unitId) return seal;
    }
    return null;
  },

  async updateSealRecord(
    id: string,
    updates: Partial<InsertSealRecordRow>,
    tx?: Tx
  ): Promise<SealRecordRow | null> {
    const client = tx ?? defaultDb;
    const existing = await this.getSealRecordById(id, tx);
    if (!existing) return null;

    const merged: SealRecordRow = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    try {
      const [row] = await client
        .update(sealRecords)
        .set(merged)
        .where(eq(sealRecords.id, id))
        .returning();
      if (row) {
        memSeals.set(id, row);
        return row;
      }
    } catch {
      // Memory fallback
    }

    memSeals.set(id, merged);
    return merged;
  },

  async listSealRecords(
    filter?: {
      skuId?: string;
      status?: SealRecordRow["status"];
      orderItemUnitId?: string;
      limit?: number;
      offset?: number;
    },
    tx?: Tx
  ): Promise<{ items: SealRecordRow[]; total: number }> {
    const client = tx ?? defaultDb;
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;

    try {
      const conditions = [];
      if (filter?.skuId) conditions.push(eq(sealRecords.skuId, filter.skuId));
      if (filter?.status) conditions.push(eq(sealRecords.status, filter.status));
      if (filter?.orderItemUnitId) conditions.push(eq(sealRecords.orderItemUnitId, filter.orderItemUnitId));

      const rows = await client
        .select()
        .from(sealRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sealRecords.createdAt))
        .limit(limit)
        .offset(offset);

      const [countRow] = await client
        .select({ count: sql<number>`count(*)::int` })
        .from(sealRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { items: rows, total: countRow?.count ?? rows.length };
    } catch {
      // Memory fallback
    }

    let all = Array.from(memSeals.values());
    if (filter?.skuId) all = all.filter((s) => s.skuId === filter.skuId);
    if (filter?.status) all = all.filter((s) => s.status === filter.status);
    if (filter?.orderItemUnitId) all = all.filter((s) => s.orderItemUnitId === filter.orderItemUnitId);

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
    };
  },

  // --------------------------------------------------------------------------
  // Seal Events (Append-only)
  // --------------------------------------------------------------------------
  async createSealEvent(
    row: InsertSealEventRow,
    tx?: Tx
  ): Promise<SealEventRow> {
    const client = tx ?? defaultDb;
    const fullRow: SealEventRow = {
      id: row.id ?? crypto.randomUUID(),
      sealId: row.sealId,
      fromStatus: row.fromStatus ?? null,
      toStatus: row.toStatus,
      actorId: row.actorId ?? null,
      reason: row.reason ?? null,
      createdAt: row.createdAt ?? new Date(),
    };

    try {
      const [inserted] = await client.insert(sealEvents).values(fullRow).returning();
      if (inserted) {
        memSealEvents.push(inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memSealEvents.push(fullRow);
    return fullRow;
  },

  async listSealEvents(sealId: string, tx?: Tx): Promise<SealEventRow[]> {
    const client = tx ?? defaultDb;
    try {
      return await client
        .select()
        .from(sealEvents)
        .where(eq(sealEvents.sealId, sealId))
        .orderBy(sealEvents.createdAt);
    } catch {
      // Memory fallback
    }

    return memSealEvents
      .filter((e) => e.sealId === sealId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  // --------------------------------------------------------------------------
  // QC Records
  // --------------------------------------------------------------------------
  async createQcRecord(
    row: InsertQcRecordRow,
    tx?: Tx
  ): Promise<QcRecordRow> {
    const client = tx ?? defaultDb;
    const fullRow: QcRecordRow = {
      id: row.id ?? crypto.randomUUID(),
      sealId: row.sealId ?? null,
      orderItemUnitId: row.orderItemUnitId ?? null,
      skuId: row.skuId,
      qcType: row.qcType,
      testChecklist: row.testChecklist,
      result: row.result,
      technicianId: row.technicianId,
      photos: row.photos ?? [],
      sampledForAudit: row.sampledForAudit ?? false,
      supervisorId: row.supervisorId ?? null,
      supervisorResult: row.supervisorResult ?? null,
      supervisorCheckedAt: row.supervisorCheckedAt ?? null,
      auditDueAt: row.auditDueAt ?? null,
      escalatedAt: row.escalatedAt ?? null,
      testerNotes: row.testerNotes ?? null,
      createdAt: row.createdAt ?? new Date(),
    };

    try {
      const [inserted] = await client.insert(qcRecords).values(fullRow).returning();
      if (inserted) {
        memQcRecords.set(inserted.id, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memQcRecords.set(fullRow.id, fullRow);
    return fullRow;
  },

  async getQcRecordById(id: string, tx?: Tx): Promise<QcRecordRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(qcRecords)
        .where(eq(qcRecords.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memQcRecords.get(id) ?? null;
  },

  async getQcRecordByUnitId(unitId: string, tx?: Tx): Promise<QcRecordRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(qcRecords)
        .where(eq(qcRecords.orderItemUnitId, unitId))
        .orderBy(desc(qcRecords.createdAt))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }

    const matches = Array.from(memQcRecords.values()).filter(
      (r) => r.orderItemUnitId === unitId
    );
    matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matches[0] ?? null;
  },

  async updateQcRecord(
    id: string,
    updates: Partial<InsertQcRecordRow>,
    tx?: Tx
  ): Promise<QcRecordRow | null> {
    const client = tx ?? defaultDb;
    const existing = await this.getQcRecordById(id, tx);
    if (!existing) return null;

    const merged: QcRecordRow = {
      ...existing,
      ...updates,
    };

    try {
      const [row] = await client
        .update(qcRecords)
        .set(merged)
        .where(eq(qcRecords.id, id))
        .returning();
      if (row) {
        memQcRecords.set(id, row);
        return row;
      }
    } catch {
      // Memory fallback
    }

    memQcRecords.set(id, merged);
    return merged;
  },

  async listQcRecords(
    filter?: {
      skuId?: string;
      orderItemUnitId?: string;
      result?: QcRecordRow["result"];
      sampledForAudit?: boolean;
      pendingSupervisorCheck?: boolean;
      limit?: number;
      offset?: number;
    },
    tx?: Tx
  ): Promise<{ items: QcRecordRow[]; total: number }> {
    const client = tx ?? defaultDb;
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;

    try {
      const conditions = [];
      if (filter?.skuId) conditions.push(eq(qcRecords.skuId, filter.skuId));
      if (filter?.orderItemUnitId) conditions.push(eq(qcRecords.orderItemUnitId, filter.orderItemUnitId));
      if (filter?.result) conditions.push(eq(qcRecords.result, filter.result));
      if (filter?.sampledForAudit !== undefined) conditions.push(eq(qcRecords.sampledForAudit, filter.sampledForAudit));
      if (filter?.pendingSupervisorCheck) {
        conditions.push(sql`${qcRecords.sampledForAudit} = true`);
        conditions.push(sql`${qcRecords.supervisorCheckedAt} IS NULL`);
      }

      const rows = await client
        .select()
        .from(qcRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(qcRecords.createdAt))
        .limit(limit)
        .offset(offset);

      const [countRow] = await client
        .select({ count: sql<number>`count(*)::int` })
        .from(qcRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { items: rows, total: countRow?.count ?? rows.length };
    } catch {
      // Memory fallback
    }

    let all = Array.from(memQcRecords.values());
    if (filter?.skuId) all = all.filter((r) => r.skuId === filter.skuId);
    if (filter?.orderItemUnitId) all = all.filter((r) => r.orderItemUnitId === filter.orderItemUnitId);
    if (filter?.result) all = all.filter((r) => r.result === filter.result);
    if (filter?.sampledForAudit !== undefined) all = all.filter((r) => r.sampledForAudit === filter.sampledForAudit);
    if (filter?.pendingSupervisorCheck) {
      all = all.filter((r) => r.sampledForAudit && !r.supervisorCheckedAt);
    }

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
    };
  },

  // --------------------------------------------------------------------------
  // Seal Void Requests
  // --------------------------------------------------------------------------
  async createVoidRequest(
    row: InsertSealVoidRequestRow,
    tx?: Tx
  ): Promise<SealVoidRequestRow> {
    const client = tx ?? defaultDb;
    const fullRow: SealVoidRequestRow = {
      id: row.id ?? crypto.randomUUID(),
      sealId: row.sealId,
      reason: row.reason,
      requestedBy: row.requestedBy,
      status: row.status ?? "PENDING",
      approvedBy: row.approvedBy ?? null,
      decidedAt: row.decidedAt ?? null,
      createdAt: row.createdAt ?? new Date(),
    };

    try {
      const [inserted] = await client.insert(sealVoidRequests).values(fullRow).returning();
      if (inserted) {
        memVoidRequests.set(inserted.id, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memVoidRequests.set(fullRow.id, fullRow);
    return fullRow;
  },

  async getVoidRequestById(id: string, tx?: Tx): Promise<SealVoidRequestRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(sealVoidRequests)
        .where(eq(sealVoidRequests.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memVoidRequests.get(id) ?? null;
  },

  async updateVoidRequest(
    id: string,
    updates: Partial<InsertSealVoidRequestRow>,
    tx?: Tx
  ): Promise<SealVoidRequestRow | null> {
    const client = tx ?? defaultDb;
    const existing = await this.getVoidRequestById(id, tx);
    if (!existing) return null;

    const merged: SealVoidRequestRow = {
      ...existing,
      ...updates,
    };

    try {
      const [row] = await client
        .update(sealVoidRequests)
        .set(merged)
        .where(eq(sealVoidRequests.id, id))
        .returning();
      if (row) {
        memVoidRequests.set(id, row);
        return row;
      }
    } catch {
      // Memory fallback
    }

    memVoidRequests.set(id, merged);
    return merged;
  },

  async listVoidRequests(
    filter?: {
      status?: SealVoidRequestRow["status"];
      sealId?: string;
      limit?: number;
      offset?: number;
    },
    tx?: Tx
  ): Promise<{ items: SealVoidRequestRow[]; total: number }> {
    const client = tx ?? defaultDb;
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;

    try {
      const conditions = [];
      if (filter?.status) conditions.push(eq(sealVoidRequests.status, filter.status));
      if (filter?.sealId) conditions.push(eq(sealVoidRequests.sealId, filter.sealId));

      const rows = await client
        .select()
        .from(sealVoidRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sealVoidRequests.createdAt))
        .limit(limit)
        .offset(offset);

      const [countRow] = await client
        .select({ count: sql<number>`count(*)::int` })
        .from(sealVoidRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { items: rows, total: countRow?.count ?? rows.length };
    } catch {
      // Memory fallback
    }

    let all = Array.from(memVoidRequests.values());
    if (filter?.status) all = all.filter((r) => r.status === filter.status);
    if (filter?.sealId) all = all.filter((r) => r.sealId === filter.sealId);

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
    };
  },
};
