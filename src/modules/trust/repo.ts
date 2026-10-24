import crypto from "node:crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import {
  sealRecords,
  sealEvents,
  qcRecords,
  sealVoidRequests,
  sealVerifications,
  sealCloneAlerts,
  SealRecordRow,
  InsertSealRecordRow,
  SealEventRow,
  InsertSealEventRow,
  QcRecordRow,
  InsertQcRecordRow,
  SealVoidRequestRow,
  InsertSealVoidRequestRow,
  SealVerificationRow,
  InsertSealVerificationRow,
  SealCloneAlertRow,
  InsertSealCloneAlertRow,
} from "./schema";

// --------------------------------------------------------------------------
// In-Memory Fallback Stores for Offline / Testing Mode
// --------------------------------------------------------------------------
const memSeals = new Map<string, SealRecordRow>();
const memSealEvents: SealEventRow[] = [];
const memQcRecords = new Map<string, QcRecordRow>();
const memVoidRequests = new Map<string, SealVoidRequestRow>();
const memVerifications: SealVerificationRow[] = [];
const memCloneAlerts = new Map<string, SealCloneAlertRow>();
const memPartitions = new Set<string>();

export function clearMemoryTrustForTesting(): void {
  memSeals.clear();
  memSealEvents.length = 0;
  memQcRecords.clear();
  memVoidRequests.clear();
  memVerifications.length = 0;
  memCloneAlerts.clear();
  memPartitions.clear();
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

  async getSealRecordByManufacturerSerial(
    serial: string,
    tx?: Tx
  ): Promise<SealRecordRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(sealRecords)
        .where(eq(sealRecords.manufacturerSerial, serial))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }

    for (const seal of memSeals.values()) {
      if (seal.manufacturerSerial === serial) return seal;
    }
    return null;
  },

  async getActiveSealsWithExpiredWarranty(
    now: Date,
    tx?: Tx
  ): Promise<SealRecordRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(sealRecords)
        .where(
          and(
            eq(sealRecords.status, "ACTIVE"),
            sql`${sealRecords.warrantyEnd} IS NOT NULL`,
            sql`${sealRecords.warrantyEnd} < ${now}`
          )
        );
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    return Array.from(memSeals.values()).filter(
      (s) => s.status === "ACTIVE" && s.warrantyEnd && s.warrantyEnd < now
    );
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

  async getQcRecordBySealId(sealId: string, tx?: Tx): Promise<QcRecordRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(qcRecords)
        .where(eq(qcRecords.sealId, sealId))
        .orderBy(desc(qcRecords.createdAt))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }

    const matches = Array.from(memQcRecords.values()).filter(
      (r) => r.sealId === sealId
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

  // --------------------------------------------------------------------------
  // 5. Seal Verifications
  // --------------------------------------------------------------------------
  async createVerification(
    row: InsertSealVerificationRow,
    tx?: Tx
  ): Promise<SealVerificationRow> {
    const client = tx ?? defaultDb;
    const fullRow: SealVerificationRow = {
      id: row.id ?? BigInt(memVerifications.length + 1),
      sealId: row.sealId ?? null,
      queryRaw: row.queryRaw,
      queryType: row.queryType,
      found: row.found,
      deviceId: row.deviceId,
      ip: row.ip,
      geoDistrict: row.geoDistrict ?? null,
      userAgent: row.userAgent,
      isQr: row.isQr ?? false,
      createdAt: row.createdAt ?? new Date(),
    };

    try {
      const [inserted] = await client
        .insert(sealVerifications)
        .values(fullRow)
        .returning();
      if (inserted) {
        memVerifications.push(inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memVerifications.push(fullRow);
    return fullRow;
  },

  async listVerifications(
    filter?: {
      sealId?: string;
      deviceId?: string;
      ip?: string;
      since?: Date;
    },
    tx?: Tx
  ): Promise<SealVerificationRow[]> {
    const client = tx ?? defaultDb;
    try {
      const conditions = [];
      if (filter?.sealId) conditions.push(eq(sealVerifications.sealId, filter.sealId));
      if (filter?.deviceId) conditions.push(eq(sealVerifications.deviceId, filter.deviceId));
      if (filter?.ip) conditions.push(eq(sealVerifications.ip, filter.ip));
      if (filter?.since) conditions.push(sql`${sealVerifications.createdAt} >= ${filter.since}`);

      const rows = await client
        .select()
        .from(sealVerifications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sealVerifications.createdAt));
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    return memVerifications.filter((v) => {
      if (filter?.sealId && v.sealId !== filter.sealId) return false;
      if (filter?.deviceId && v.deviceId !== filter.deviceId) return false;
      if (filter?.ip && v.ip !== filter.ip) return false;
      if (filter?.since && v.createdAt < filter.since) return false;
      return true;
    });
  },

  // --------------------------------------------------------------------------
  // 6. Seal Clone Alerts & Anomaly Query
  // --------------------------------------------------------------------------
  async findClonedSealCandidates(
    since: Date,
    minDevices = 5,
    minDistricts = 2,
    tx?: Tx
  ): Promise<
    Array<{
      sealId: string;
      distinctDevices: number;
      distinctDistricts: string[];
      totalScans24h: number;
    }>
  > {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select({
          sealId: sealVerifications.sealId,
          distinctDevices: sql<number>`count(distinct ${sealVerifications.deviceId})::int`,
          distinctDistricts: sql<string[]>`array_agg(distinct ${sealVerifications.geoDistrict}) filter (where ${sealVerifications.geoDistrict} is not null)`,
          totalScans24h: sql<number>`count(*)::int`,
        })
        .from(sealVerifications)
        .where(
          and(
            sql`${sealVerifications.createdAt} > ${since}`,
            sql`${sealVerifications.sealId} IS NOT NULL`
          )
        )
        .groupBy(sealVerifications.sealId)
        .having(
          and(
            sql`count(distinct ${sealVerifications.deviceId}) >= ${minDevices}`,
            sql`count(distinct ${sealVerifications.geoDistrict}) >= ${minDistricts}`
          )
        );
      if (rows.length > 0) {
        return rows.map((r) => ({
          sealId: r.sealId!,
          distinctDevices: Number(r.distinctDevices),
          distinctDistricts: (r.distinctDistricts || []).filter(Boolean),
          totalScans24h: Number(r.totalScans24h),
        }));
      }
    } catch {
      // Memory fallback
    }

    // Memory aggregation fallback
    const relevant = memVerifications.filter(
      (v) => v.createdAt > since && v.sealId !== null
    );

    const grouped = new Map<
      string,
      { devices: Set<string>; districts: Set<string>; count: number }
    >();

    for (const v of relevant) {
      const sealId = v.sealId!;
      const entry = grouped.get(sealId) ?? {
        devices: new Set<string>(),
        districts: new Set<string>(),
        count: 0,
      };
      entry.devices.add(v.deviceId);
      if (v.geoDistrict) entry.districts.add(v.geoDistrict);
      entry.count += 1;
      grouped.set(sealId, entry);
    }

    const candidates: Array<{
      sealId: string;
      distinctDevices: number;
      distinctDistricts: string[];
      totalScans24h: number;
    }> = [];

    for (const [sealId, data] of grouped.entries()) {
      if (data.devices.size >= minDevices && data.districts.size >= minDistricts) {
        candidates.push({
          sealId,
          distinctDevices: data.devices.size,
          distinctDistricts: Array.from(data.districts),
          totalScans24h: data.count,
        });
      }
    }

    return candidates;
  },

  async getRecentCloneAlertBySealId(
    sealId: string,
    hours = 24,
    tx?: Tx
  ): Promise<SealCloneAlertRow | null> {
    const client = tx ?? defaultDb;
    const cutoff = new Date(Date.now() - hours * 3600 * 1000);

    try {
      const [row] = await client
        .select()
        .from(sealCloneAlerts)
        .where(
          and(
            eq(sealCloneAlerts.sealId, sealId),
            sql`${sealCloneAlerts.createdAt} >= ${cutoff}`
          )
        )
        .orderBy(desc(sealCloneAlerts.createdAt))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }

    for (const alert of memCloneAlerts.values()) {
      if (alert.sealId === sealId && alert.createdAt >= cutoff) {
        return alert;
      }
    }
    return null;
  },

  async createCloneAlert(
    row: InsertSealCloneAlertRow,
    tx?: Tx
  ): Promise<SealCloneAlertRow> {
    const client = tx ?? defaultDb;
    const fullRow: SealCloneAlertRow = {
      id: row.id ?? crypto.randomUUID(),
      sealId: row.sealId,
      reason: row.reason,
      distinctDevices: row.distinctDevices,
      distinctDistricts: row.distinctDistricts,
      totalScans24h: row.totalScans24h,
      status: row.status ?? "OPEN",
      resolvedBy: row.resolvedBy ?? null,
      notes: row.notes ?? null,
      createdAt: row.createdAt ?? new Date(),
    };

    try {
      const [inserted] = await client
        .insert(sealCloneAlerts)
        .values(fullRow)
        .returning();
      if (inserted) {
        memCloneAlerts.set(inserted.id, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memCloneAlerts.set(fullRow.id, fullRow);
    return fullRow;
  },

  async getCloneAlertById(id: string, tx?: Tx): Promise<SealCloneAlertRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(sealCloneAlerts)
        .where(eq(sealCloneAlerts.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memCloneAlerts.get(id) ?? null;
  },

  async listCloneAlerts(
    filter?: { status?: string },
    tx?: Tx
  ): Promise<SealCloneAlertRow[]> {
    const client = tx ?? defaultDb;
    try {
      const conditions = [];
      if (filter?.status) conditions.push(eq(sealCloneAlerts.status, filter.status as any));

      const rows = await client
        .select()
        .from(sealCloneAlerts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sealCloneAlerts.createdAt));
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    let all = Array.from(memCloneAlerts.values());
    if (filter?.status) {
      all = all.filter((a) => a.status === filter.status);
    }
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async updateCloneAlert(
    id: string,
    updates: Partial<SealCloneAlertRow>,
    tx?: Tx
  ): Promise<SealCloneAlertRow | null> {
    const client = tx ?? defaultDb;
    const existing = await this.getCloneAlertById(id, tx);
    if (!existing) return null;

    const merged: SealCloneAlertRow = {
      ...existing,
      ...updates,
    };

    try {
      const [row] = await client
        .update(sealCloneAlerts)
        .set(updates)
        .where(eq(sealCloneAlerts.id, id))
        .returning();
      if (row) {
        memCloneAlerts.set(id, row);
        return row;
      }
    } catch {
      // Memory fallback
    }

    memCloneAlerts.set(id, merged);
    return merged;
  },

  // --------------------------------------------------------------------------
  // 7. Partition Maintenance
  // --------------------------------------------------------------------------
  async ensureMonthlyPartition(
    tableName: string,
    fromDate: Date,
    toDate: Date,
    tx?: Tx
  ): Promise<void> {
    const client = tx ?? defaultDb;
    memPartitions.add(tableName);

    try {
      const fromStr = fromDate.toISOString();
      const toStr = toDate.toISOString();
      await client.execute(
        sql.raw(
          `CREATE TABLE IF NOT EXISTS ${tableName} PARTITION OF seal_verifications FOR VALUES FROM ('${fromStr}') TO ('${toStr}');`
        )
      );
    } catch {
      // Memory fallback
    }
  },

  async dropOldPartitions(cutoffDate: Date, tx?: Tx): Promise<string[]> {
    const client = tx ?? defaultDb;
    const dropped: string[] = [];

    for (const partition of Array.from(memPartitions)) {
      // Expected naming: seal_verifications_YYYY_MM
      const parts = partition.split("_");
      if (parts.length >= 4) {
        const year = Number(parts[2]);
        const month = Number(parts[3]);
        const partitionDate = new Date(year, month - 1, 1);
        if (partitionDate < cutoffDate) {
          try {
            await client.execute(sql.raw(`DROP TABLE IF EXISTS ${partition};`));
          } catch {
            // Memory fallback
          }
          memPartitions.delete(partition);
          dropped.push(partition);
        }
      }
    }
    return dropped;
  },

  getCreatedPartitions(): string[] {
    return Array.from(memPartitions);
  },
};
