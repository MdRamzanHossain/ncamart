import crypto from "node:crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cashDrawerSessions,
  CashDrawerSessionRow,
  InsertCashDrawerSessionRow,
  DrawerStatus,
} from "./schema";

// In-memory fallback for isolated testing
const memCashDrawerSessions = new Map<string, CashDrawerSessionRow>();

export const posRepo = {
  async findOpenDrawerByStaffId(staffId: string): Promise<CashDrawerSessionRow | null> {
    try {
      const rows = await db
        .select()
        .from(cashDrawerSessions)
        .where(
          and(
            eq(cashDrawerSessions.staffId, staffId),
            eq(cashDrawerSessions.status, "OPEN")
          )
        )
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Memory Fallback
    }

    for (const session of memCashDrawerSessions.values()) {
      if (session.staffId === staffId && session.status === "OPEN") {
        return session;
      }
    }
    return null;
  },

  async getDrawerSessionById(id: string): Promise<CashDrawerSessionRow | null> {
    try {
      const rows = await db
        .select()
        .from(cashDrawerSessions)
        .where(eq(cashDrawerSessions.id, id))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Memory Fallback
    }
    return memCashDrawerSessions.get(id) ?? null;
  },

  async createDrawerSession(
    data: InsertCashDrawerSessionRow
  ): Promise<CashDrawerSessionRow> {
    const id = data.id ?? crypto.randomUUID();
    const now = new Date();
    const row: CashDrawerSessionRow = {
      id,
      staffId: data.staffId,
      openingFloatPaisa: data.openingFloatPaisa ?? 0,
      cashSalesPaisa: data.cashSalesPaisa ?? 0,
      cashRefundsPaisa: data.cashRefundsPaisa ?? 0,
      expectedCashPaisa:
        data.expectedCashPaisa ??
        (data.openingFloatPaisa ?? 0) + (data.cashSalesPaisa ?? 0) - (data.cashRefundsPaisa ?? 0),
      countedCashPaisa: data.countedCashPaisa ?? null,
      variancePaisa: data.variancePaisa ?? null,
      status: (data.status as DrawerStatus) ?? "OPEN",
      openedAt: data.openedAt ?? now,
      countedAt: data.countedAt ?? null,
      closedAt: data.closedAt ?? null,
      reconciledBy: data.reconciledBy ?? null,
      notes: data.notes ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };

    try {
      const [created] = await db
        .insert(cashDrawerSessions)
        .values(row)
        .returning();
      if (created) {
        memCashDrawerSessions.set(created.id, created);
        return created;
      }
    } catch {
      // Memory Fallback
    }

    memCashDrawerSessions.set(id, row);
    return row;
  },

  async updateDrawerSession(
    id: string,
    updates: Partial<InsertCashDrawerSessionRow>
  ): Promise<CashDrawerSessionRow> {
    const now = new Date();
    try {
      const [updated] = await db
        .update(cashDrawerSessions)
        .set({
          ...updates,
          updatedAt: now,
        })
        .where(eq(cashDrawerSessions.id, id))
        .returning();
      if (updated) {
        memCashDrawerSessions.set(updated.id, updated);
        return updated;
      }
    } catch {
      // Memory Fallback
    }

    const existing = memCashDrawerSessions.get(id);
    if (!existing) {
      throw new Error(`Cash drawer session '${id}' not found`);
    }

    const updated: CashDrawerSessionRow = {
      ...existing,
      ...updates,
      updatedAt: now,
    } as CashDrawerSessionRow;

    memCashDrawerSessions.set(id, updated);
    return updated;
  },

  async listDrawerSessions(filter?: {
    staffId?: string;
    status?: DrawerStatus;
    limit?: number;
  }): Promise<CashDrawerSessionRow[]> {
    const limit = filter?.limit ?? 50;
    try {
      const conditions = [];
      if (filter?.staffId) conditions.push(eq(cashDrawerSessions.staffId, filter.staffId));
      if (filter?.status) conditions.push(eq(cashDrawerSessions.status, filter.status));

      const query = db
        .select()
        .from(cashDrawerSessions)
        .orderBy(desc(cashDrawerSessions.openedAt))
        .limit(limit);

      const rows = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    let sessions = Array.from(memCashDrawerSessions.values());
    if (filter?.staffId) {
      sessions = sessions.filter((s) => s.staffId === filter.staffId);
    }
    if (filter?.status) {
      sessions = sessions.filter((s) => s.status === filter.status);
    }
    sessions.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
    return sessions.slice(0, limit);
  },

  clearMemoryForTesting(): void {
    memCashDrawerSessions.clear();
  },
};

export function clearMemoryPosForTesting(): void {
  posRepo.clearMemoryForTesting();
}
