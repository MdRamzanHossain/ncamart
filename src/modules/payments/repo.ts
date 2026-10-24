import { eq, and, desc, sql, lte, lt } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import { env } from "@/lib/env";
import {
  refunds,
  refundEvents,
  RefundRow,
  InsertRefundRow,
  RefundEventRow,
  InsertRefundEventRow,
} from "./schema";
import { ListRefundsQuery } from "./dto";

// In-memory fallback stores for test isolation and offline mode
const memRefunds = new Map<string, RefundRow>();
const memRefundEvents = new Map<string, RefundEventRow>();

export function clearMemoryRefundsForTesting(): void {
  memRefunds.clear();
  memRefundEvents.clear();
}

export const refundsRepo = {
  clearMemoryForTesting(): void {
    clearMemoryRefundsForTesting();
  },

  async createRefund(
    data: InsertRefundRow,
    tx?: Tx | null
  ): Promise<RefundRow> {
    const db = tx ?? defaultDb;
    const id = data.id || crypto.randomUUID();
    const now = new Date();
    const row: RefundRow = {
      id,
      refundNumber: data.refundNumber,
      orderId: data.orderId,
      orderItemIds: data.orderItemIds ?? [],
      paymentTranId: data.paymentTranId ?? null,
      amountPaisa: data.amountPaisa,
      reason: data.reason,
      method: data.method,
      status: data.status ?? "REQUESTED",
      isBeforeDelivery: data.isBeforeDelivery ?? true,
      requestedByType: data.requestedByType ?? "SYSTEM",
      requestedById: data.requestedById ?? null,
      approvedBy: data.approvedBy ?? null,
      approvedAt: data.approvedAt ? new Date(data.approvedAt) : null,
      executedBy: data.executedBy ?? null,
      executedAt: data.executedAt ? new Date(data.executedAt) : null,
      externalRef: data.externalRef ?? null,
      proofMediaId: data.proofMediaId ?? null,
      gatewayRefundRef: data.gatewayRefundRef ?? null,
      payoutAccount: data.payoutAccount ?? null,
      dueBy: data.dueBy ? new Date(data.dueBy) : null,
      createdAt: data.createdAt ? new Date(data.createdAt) : now,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : now,
    };

    if (env.MOCK_EXTERNAL_SERVICES) {
      memRefunds.set(id, row);
      return row;
    }

    try {
      const [inserted] = await db.insert(refunds).values(row).returning();
      if (inserted) {
        memRefunds.set(id, inserted);
        return inserted;
      }
      memRefunds.set(id, row);
      return row;
    } catch {
      memRefunds.set(id, row);
      return row;
    }
  },

  async getRefundById(
    id: string,
    tx?: Tx | null
  ): Promise<RefundRow | null> {
    if (env.MOCK_EXTERNAL_SERVICES) {
      return memRefunds.get(id) ?? null;
    }

    try {
      const db = tx ?? defaultDb;
      const [row] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, id))
        .limit(1);
      return row ?? memRefunds.get(id) ?? null;
    } catch {
      return memRefunds.get(id) ?? null;
    }
  },

  async getRefundByNumber(
    refundNumber: string,
    tx?: Tx | null
  ): Promise<RefundRow | null> {
    if (env.MOCK_EXTERNAL_SERVICES) {
      for (const r of memRefunds.values()) {
        if (r.refundNumber === refundNumber) return r;
      }
      return null;
    }

    try {
      const db = tx ?? defaultDb;
      const [row] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.refundNumber, refundNumber))
        .limit(1);
      if (row) return row;
    } catch {
      // fallback
    }

    for (const r of memRefunds.values()) {
      if (r.refundNumber === refundNumber) return r;
    }
    return null;
  },

  async getRefundByIdOrNumber(
    identifier: string,
    tx?: Tx | null
  ): Promise<RefundRow | null> {
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      )
    ) {
      return this.getRefundById(identifier, tx);
    }
    return this.getRefundByNumber(identifier, tx);
  },

  async updateRefund(
    id: string,
    updates: Partial<InsertRefundRow>,
    tx?: Tx | null
  ): Promise<RefundRow> {
    const now = new Date();
    const existing = await this.getRefundById(id, tx);
    if (!existing) {
      throw new Error(`Refund '${id}' not found`);
    }

    const merged: RefundRow = {
      ...existing,
      ...updates,
      approvedAt: updates.approvedAt ? new Date(updates.approvedAt) : existing.approvedAt,
      executedAt: updates.executedAt ? new Date(updates.executedAt) : existing.executedAt,
      dueBy: updates.dueBy ? new Date(updates.dueBy) : existing.dueBy,
      updatedAt: now,
    };

    if (env.MOCK_EXTERNAL_SERVICES) {
      memRefunds.set(id, merged);
      return merged;
    }

    try {
      const db = tx ?? defaultDb;
      const [row] = await db
        .update(refunds)
        .set({ ...updates, updatedAt: now })
        .where(eq(refunds.id, id))
        .returning();
      if (row) {
        memRefunds.set(id, row);
        return row;
      }
    } catch {
      // fallback
    }

    memRefunds.set(id, merged);
    return merged;
  },

  async listRefundsForOrder(
    orderId: string,
    tx?: Tx | null
  ): Promise<RefundRow[]> {
    if (env.MOCK_EXTERNAL_SERVICES) {
      return Array.from(memRefunds.values())
        .filter((r) => r.orderId === orderId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    try {
      const db = tx ?? defaultDb;
      const rows = await db
        .select()
        .from(refunds)
        .where(eq(refunds.orderId, orderId))
        .orderBy(desc(refunds.createdAt));
      if (rows.length > 0) return rows;
    } catch {
      // fallback
    }

    return Array.from(memRefunds.values())
      .filter((r) => r.orderId === orderId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async listRefunds(
    query?: ListRefundsQuery,
    tx?: Tx | null
  ): Promise<{ items: RefundRow[]; total: number }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const offset = (page - 1) * limit;
    const now = new Date();

    if (env.MOCK_EXTERNAL_SERVICES) {
      let filtered = Array.from(memRefunds.values());
      if (query?.status) {
        filtered = filtered.filter((r) => r.status === query.status);
      }
      if (query?.method) {
        filtered = filtered.filter((r) => r.method === query.method);
      }
      if (query?.order_id) {
        filtered = filtered.filter((r) => r.orderId === query.order_id);
      }
      if (query?.overdue) {
        filtered = filtered.filter(
          (r) =>
            r.dueBy &&
            r.dueBy.getTime() < now.getTime() &&
            r.status !== "COMPLETED" &&
            r.status !== "REJECTED"
        );
      }

      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const total = filtered.length;
      return { items: filtered.slice(offset, offset + limit), total };
    }

    try {
      const db = tx ?? defaultDb;
      let all = await db
        .select()
        .from(refunds)
        .orderBy(desc(refunds.createdAt));

      if (query?.status) {
        all = all.filter((r) => r.status === query.status);
      }
      if (query?.method) {
        all = all.filter((r) => r.method === query.method);
      }
      if (query?.order_id) {
        all = all.filter((r) => r.orderId === query.order_id);
      }
      if (query?.overdue) {
        all = all.filter(
          (r) =>
            r.dueBy &&
            new Date(r.dueBy).getTime() < now.getTime() &&
            r.status !== "COMPLETED" &&
            r.status !== "REJECTED"
        );
      }

      const total = all.length;
      return { items: all.slice(offset, offset + limit), total };
    } catch {
      // Memory fallback
      let filtered = Array.from(memRefunds.values());
      if (query?.status) {
        filtered = filtered.filter((r) => r.status === query.status);
      }
      if (query?.method) {
        filtered = filtered.filter((r) => r.method === query.method);
      }
      if (query?.order_id) {
        filtered = filtered.filter((r) => r.orderId === query.order_id);
      }
      if (query?.overdue) {
        filtered = filtered.filter(
          (r) =>
            r.dueBy &&
            r.dueBy.getTime() < now.getTime() &&
            r.status !== "COMPLETED" &&
            r.status !== "REJECTED"
        );
      }

      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const total = filtered.length;
      return { items: filtered.slice(offset, offset + limit), total };
    }
  },

  async recordRefundEvent(
    data: InsertRefundEventRow,
    tx?: Tx | null
  ): Promise<RefundEventRow> {
    const id = data.id || crypto.randomUUID();
    const now = new Date();
    const row: RefundEventRow = {
      id,
      refundId: data.refundId,
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus,
      actorType: data.actorType,
      actorId: data.actorId ?? null,
      notes: data.notes ?? null,
      metadata: (data.metadata ?? null) as Record<string, unknown> | null,
      createdAt: data.createdAt ? new Date(data.createdAt) : now,
    };

    if (env.MOCK_EXTERNAL_SERVICES) {
      memRefundEvents.set(id, row);
      return row;
    }

    try {
      const db = tx ?? defaultDb;
      const [inserted] = await db.insert(refundEvents).values(row).returning();
      if (inserted) {
        memRefundEvents.set(id, inserted);
        return inserted;
      }
    } catch {
      // fallback
    }

    memRefundEvents.set(id, row);
    return row;
  },

  async listRefundEvents(
    refundId: string,
    tx?: Tx | null
  ): Promise<RefundEventRow[]> {
    if (env.MOCK_EXTERNAL_SERVICES) {
      return Array.from(memRefundEvents.values())
        .filter((e) => e.refundId === refundId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    try {
      const db = tx ?? defaultDb;
      const rows = await db
        .select()
        .from(refundEvents)
        .where(eq(refundEvents.refundId, refundId))
        .orderBy(refundEvents.createdAt);
      if (rows.length > 0) return rows;
    } catch {
      // fallback
    }

    return Array.from(memRefundEvents.values())
      .filter((e) => e.refundId === refundId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async getOverdueApprovedRefunds(
    cutoff: Date,
    tx?: Tx | null
  ): Promise<RefundRow[]> {
    const all = Array.from(memRefunds.values());
    return all.filter(
      (r) =>
        r.status === "APPROVED" &&
        r.approvedAt &&
        r.approvedAt.getTime() < cutoff.getTime()
    );
  },

  async getOverdueOpenRefunds(
    now: Date,
    tx?: Tx | null
  ): Promise<RefundRow[]> {
    const all = Array.from(memRefunds.values());
    return all.filter(
      (r) =>
        (r.status === "APPROVED" || r.status === "PROCESSING") &&
        r.dueBy &&
        r.dueBy.getTime() < now.getTime()
    );
  },
};
