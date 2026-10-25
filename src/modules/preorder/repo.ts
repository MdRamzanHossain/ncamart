import { eq, and, sql, lte, gte } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import {
  supportTasks,
  flashDeals,
  SupportTaskRow,
  InsertSupportTaskRow,
  FlashDealRow,
  InsertFlashDealRow,
  SupportTaskStatus,
  SupportTaskType,
  FlashDealStatus,
} from "./schema";

// In-Memory Fallback Stores for testing & offline mode
const memSupportTasks = new Map<string, SupportTaskRow>();
const memFlashDeals = new Map<string, FlashDealRow>();

export function clearMemoryPreorderForTesting(): void {
  memSupportTasks.clear();
  memFlashDeals.clear();
}

export const preorderRepo = {
  /**
   * Create support task (e.g. Day 7 phone call task).
   */
  async createSupportTask(
    task: InsertSupportTaskRow,
    tx?: Tx
  ): Promise<SupportTaskRow> {
    const client = tx ?? defaultDb;
    const id = task.id ?? crypto.randomUUID();
    const toInsert = {
      ...task,
      id,
    };

    try {
      const [created] = await client
        .insert(supportTasks)
        .values(toInsert)
        .returning();
      if (created) {
        memSupportTasks.set(id, created);
        return created;
      }
    } catch {
      // Memory Fallback
    }

    const row: SupportTaskRow = {
      ...toInsert,
      id,
      orderId: toInsert.orderId ?? null,
      customerId: toInsert.customerId ?? null,
      status: toInsert.status ?? "PENDING",
      assignedTo: toInsert.assignedTo ?? null,
      resolutionNotes: toInsert.resolutionNotes ?? null,
      completedAt: toInsert.completedAt ?? null,
      completedBy: toInsert.completedBy ?? null,
      metadata: toInsert.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memSupportTasks.set(id, row);
    return row;
  },

  /**
   * List support tasks with optional status, customer, and order filters.
   */
  async listSupportTasks(
    filter?: {
      orderId?: string;
      customerId?: string;
      assignedTo?: string;
      status?: SupportTaskStatus;
      type?: SupportTaskType;
    },
    tx?: Tx
  ): Promise<SupportTaskRow[]> {
    const client = tx ?? defaultDb;
    try {
      const conditions = [];
      if (filter?.orderId) conditions.push(eq(supportTasks.orderId, filter.orderId));
      if (filter?.customerId) conditions.push(eq(supportTasks.customerId, filter.customerId));
      if (filter?.assignedTo) conditions.push(eq(supportTasks.assignedTo, filter.assignedTo));
      if (filter?.status) conditions.push(eq(supportTasks.status, filter.status));
      if (filter?.type) conditions.push(eq(supportTasks.type, filter.type));

      const rows = await client
        .select()
        .from(supportTasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(supportTasks.dueAt);
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    let all = Array.from(memSupportTasks.values());
    if (filter?.orderId) all = all.filter((t) => t.orderId === filter.orderId);
    if (filter?.customerId) all = all.filter((t) => t.customerId === filter.customerId);
    if (filter?.assignedTo) all = all.filter((t) => t.assignedTo === filter.assignedTo);
    if (filter?.status) all = all.filter((t) => t.status === filter.status);
    if (filter?.type) all = all.filter((t) => t.type === filter.type);

    return all.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  },

  /**
   * Update support task status / assignment.
   */
  async updateSupportTask(
    id: string,
    updates: Partial<InsertSupportTaskRow>,
    tx?: Tx
  ): Promise<SupportTaskRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(supportTasks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(supportTasks.id, id))
        .returning();
      if (updated) {
        memSupportTasks.set(id, updated);
        return updated;
      }
    } catch {
      // Memory Fallback
    }

    const existing = memSupportTasks.get(id);
    if (!existing) {
      throw new Error(`Support task '${id}' not found`);
    }

    const updated: SupportTaskRow = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    memSupportTasks.set(id, updated);
    return updated;
  },

  /**
   * Create flash deal record (for forfeited pre-order physical units).
   */
  async createFlashDeal(
    deal: InsertFlashDealRow,
    tx?: Tx
  ): Promise<FlashDealRow> {
    const client = tx ?? defaultDb;
    const id = deal.id ?? crypto.randomUUID();
    const toInsert = {
      ...deal,
      id,
    };

    try {
      const [created] = await client
        .insert(flashDeals)
        .values(toInsert)
        .returning();
      if (created) {
        memFlashDeals.set(id, created);
        return created;
      }
    } catch {
      // Memory Fallback
    }

    const row: FlashDealRow = {
      ...toInsert,
      id,
      status: toInsert.status ?? "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memFlashDeals.set(id, row);
    return row;
  },

  /**
   * List flash deals.
   */
  async listFlashDeals(
    filter?: {
      skuId?: string;
      status?: FlashDealStatus;
    },
    tx?: Tx
  ): Promise<FlashDealRow[]> {
    const client = tx ?? defaultDb;
    try {
      const conditions = [];
      if (filter?.skuId) conditions.push(eq(flashDeals.skuId, filter.skuId));
      if (filter?.status) conditions.push(eq(flashDeals.status, filter.status));

      const rows = await client
        .select()
        .from(flashDeals)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(flashDeals.startsAt);
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    let all = Array.from(memFlashDeals.values());
    if (filter?.skuId) all = all.filter((d) => d.skuId === filter.skuId);
    if (filter?.status) all = all.filter((d) => d.status === filter.status);

    return all;
  },

  /**
   * Find active flash deal for SKU within current time window.
   */
  async getActiveFlashDealForSku(
    skuId: string,
    now: Date = new Date(),
    tx?: Tx
  ): Promise<FlashDealRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [deal] = await client
        .select()
        .from(flashDeals)
        .where(
          and(
            eq(flashDeals.skuId, skuId),
            eq(flashDeals.status, "ACTIVE"),
            lte(flashDeals.startsAt, now),
            gte(flashDeals.endsAt, now)
          )
        )
        .limit(1);
      if (deal) return deal;
    } catch {
      // Memory Fallback
    }

    for (const d of memFlashDeals.values()) {
      if (
        d.skuId === skuId &&
        d.status === "ACTIVE" &&
        d.startsAt.getTime() <= now.getTime() &&
        d.endsAt.getTime() >= now.getTime()
      ) {
        return d;
      }
    }
    return null;
  },

  async findActiveFlashDealForSku(
    skuId: string,
    now: Date = new Date(),
    tx?: Tx
  ): Promise<FlashDealRow | null> {
    return this.getActiveFlashDealForSku(skuId, now, tx);
  },
};
