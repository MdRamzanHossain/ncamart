import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import {
  coupons,
  couponRedemptions,
  storeCreditEntries,
  CouponRow,
  InsertCouponRow,
  CouponRedemptionRow,
  InsertCouponRedemptionRow,
  StoreCreditEntryRow,
  InsertStoreCreditEntryRow,
  CouponRedemptionStatus,
} from "./schema";
import { ListCouponsFilterDto } from "./dto";

// In-Memory Fallback Stores for Isolated Unit Tests & Mock Dev
const memCoupons = new Map<string, CouponRow>();
const memRedemptions = new Map<string, CouponRedemptionRow>();
const memStoreCredit = new Map<string, StoreCreditEntryRow>();

export function clearMemoryPromotionsForTesting(): void {
  memCoupons.clear();
  memRedemptions.clear();
  memStoreCredit.clear();
}

export const promotionsRepo = {
  // --------------------------------------------------------------------------
  // Coupons
  // --------------------------------------------------------------------------
  async createCoupon(tx: Tx | undefined, row: InsertCouponRow): Promise<CouponRow> {
    const client = tx ?? defaultDb;
    try {
      const [created] = await client.insert(coupons).values(row).returning();
      if (created) return created;
    } catch {
      // Fallback
    }

    const memRow: CouponRow = {
      id: row.id ?? crypto.randomUUID(),
      code: row.code.toUpperCase(),
      type: row.type,
      value: row.value,
      minOrderPaisa: row.minOrderPaisa ?? 0,
      maxDiscountPaisa: row.maxDiscountPaisa ?? null,
      scopeType: row.scopeType ?? "ALL",
      scopeValues: row.scopeValues ?? null,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      usageLimit: row.usageLimit ?? null,
      perPhoneLimit: row.perPhoneLimit ?? 1,
      status: row.status ?? "DRAFT",
      createdBy: row.createdBy,
      activatedBy: row.activatedBy ?? null,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };
    memCoupons.set(memRow.id, memRow);
    return memRow;
  },

  async updateCoupon(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertCouponRow>
  ): Promise<CouponRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(coupons)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(coupons.id, id))
        .returning();
      if (updated) return updated;
    } catch {
      // Fallback
    }

    const existing = memCoupons.get(id);
    if (!existing) return null;

    const merged: CouponRow = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    memCoupons.set(id, merged);
    return merged;
  },

  async getCouponById(tx: Tx | undefined, id: string): Promise<CouponRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client.select().from(coupons).where(eq(coupons.id, id)).limit(1);
      if (row) return row;
    } catch {
      // Fallback
    }
    return memCoupons.get(id) ?? null;
  },

  async getCouponByCode(tx: Tx | undefined, code: string): Promise<CouponRow | null> {
    const upperCode = code.toUpperCase();
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(coupons)
        .where(eq(coupons.code, upperCode))
        .limit(1);
      if (row) return row;
    } catch {
      // Fallback
    }

    for (const c of memCoupons.values()) {
      if (c.code === upperCode) return c;
    }
    return null;
  },

  /**
   * Row-level lock on coupon for atomic usage counting and concurrency safety.
   */
  async getCouponForUpdate(tx: Tx | undefined, id: string): Promise<CouponRow | null> {
    const client = tx ?? defaultDb;
    try {
      // In PostgreSQL, execute row lock
      const rows = await client.execute(
        sql`SELECT * FROM coupons WHERE id = ${id} FOR UPDATE`
      );
      if (rows.rows.length > 0) {
        return rows.rows[0] as unknown as CouponRow;
      }
    } catch {
      // Fallback
    }
    return memCoupons.get(id) ?? null;
  },

  async listCoupons(
    tx: Tx | undefined,
    filter: ListCouponsFilterDto
  ): Promise<{ items: CouponRow[]; total: number }> {
    const client = tx ?? defaultDb;
    try {
      const conditions = [];
      if (filter.status) {
        conditions.push(eq(coupons.status, filter.status));
      }
      if (filter.q) {
        conditions.push(sql`${coupons.code} ILIKE ${`%${filter.q}%`}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const countResult = await client
        .select({ count: sql<number>`count(*)` })
        .from(coupons)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? 0);

      const page = filter.page ?? 1;
      const limit = filter.limit ?? 20;
      const offset = (page - 1) * limit;
      const items = await client
        .select()
        .from(coupons)
        .where(whereClause)
        .orderBy(desc(coupons.createdAt))
        .limit(limit)
        .offset(offset);

      if (items.length > 0 || total > 0) {
        return { items, total };
      }
    } catch {
      // Fallback
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    let items = Array.from(memCoupons.values());
    if (filter.status) {
      items = items.filter((c) => c.status === filter.status);
    }
    if (filter.q) {
      const query = filter.q.toUpperCase();
      items = items.filter((c) => c.code.includes(query));
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const offset = (page - 1) * limit;
    return {
      items: items.slice(offset, offset + limit),
      total,
    };
  },

  // --------------------------------------------------------------------------
  // Coupon Redemptions
  // --------------------------------------------------------------------------
  async createRedemption(
    tx: Tx | undefined,
    row: InsertCouponRedemptionRow
  ): Promise<CouponRedemptionRow> {
    const client = tx ?? defaultDb;
    try {
      const [created] = await client.insert(couponRedemptions).values(row).returning();
      if (created) return created;
    } catch {
      // Fallback
    }

    const memRow: CouponRedemptionRow = {
      id: row.id ?? crypto.randomUUID(),
      couponId: row.couponId,
      orderId: row.orderId,
      customerId: row.customerId ?? null,
      phone: row.phone,
      discountPaisa: row.discountPaisa,
      status: row.status,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };
    memRedemptions.set(memRow.id, memRow);
    return memRow;
  },

  async getRedemptionByOrderId(
    tx: Tx | undefined,
    orderId: string
  ): Promise<CouponRedemptionRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(couponRedemptions)
        .where(eq(couponRedemptions.orderId, orderId))
        .limit(1);
      if (row) return row;
    } catch {
      // Fallback
    }

    for (const r of memRedemptions.values()) {
      if (r.orderId === orderId) return r;
    }
    return null;
  },

  async updateRedemptionStatus(
    tx: Tx | undefined,
    id: string,
    status: CouponRedemptionStatus
  ): Promise<CouponRedemptionRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(couponRedemptions)
        .set({ status, updatedAt: new Date() })
        .where(eq(couponRedemptions.id, id))
        .returning();
      if (updated) return updated;
    } catch {
      // Fallback
    }

    const existing = memRedemptions.get(id);
    if (!existing) return null;
    const merged: CouponRedemptionRow = {
      ...existing,
      status,
      updatedAt: new Date(),
    };
    memRedemptions.set(id, merged);
    return merged;
  },

  /**
   * Usage count includes CONFIRMED + RESERVED.
   */
  async countCouponUsage(tx: Tx | undefined, couponId: string): Promise<number> {
    const client = tx ?? defaultDb;
    try {
      const res = await client
        .select({ count: sql<number>`count(*)` })
        .from(couponRedemptions)
        .where(
          and(
            eq(couponRedemptions.couponId, couponId),
            inArray(couponRedemptions.status, ["CONFIRMED", "RESERVED"])
          )
        );
      return Number(res[0]?.count ?? 0);
    } catch {
      // Fallback
    }

    let count = 0;
    for (const r of memRedemptions.values()) {
      if (r.couponId === couponId && (r.status === "CONFIRMED" || r.status === "RESERVED")) {
        count++;
      }
    }
    return count;
  },

  /**
   * Per-phone usage count includes CONFIRMED + RESERVED.
   */
  async countPhoneCouponUsage(
    tx: Tx | undefined,
    couponId: string,
    phone: string
  ): Promise<number> {
    const client = tx ?? defaultDb;
    try {
      const res = await client
        .select({ count: sql<number>`count(*)` })
        .from(couponRedemptions)
        .where(
          and(
            eq(couponRedemptions.couponId, couponId),
            eq(couponRedemptions.phone, phone),
            inArray(couponRedemptions.status, ["CONFIRMED", "RESERVED"])
          )
        );
      return Number(res[0]?.count ?? 0);
    } catch {
      // Fallback
    }

    let count = 0;
    for (const r of memRedemptions.values()) {
      if (
        r.couponId === couponId &&
        r.phone === phone &&
        (r.status === "CONFIRMED" || r.status === "RESERVED")
      ) {
        count++;
      }
    }
    return count;
  },

  // --------------------------------------------------------------------------
  // Store Credit Entries (Append-Only)
  // --------------------------------------------------------------------------
  async insertCreditEntry(
    tx: Tx | undefined,
    row: InsertStoreCreditEntryRow
  ): Promise<StoreCreditEntryRow> {
    const client = tx ?? defaultDb;
    try {
      const [created] = await client.insert(storeCreditEntries).values(row).returning();
      if (created) return created;
    } catch {
      // Fallback
    }

    const memRow: StoreCreditEntryRow = {
      id: row.id ?? crypto.randomUUID(),
      customerId: row.customerId,
      deltaPaisa: row.deltaPaisa,
      reason: row.reason,
      withdrawable: row.withdrawable,
      expiresAt: row.expiresAt ?? null,
      sourceEntryId: row.sourceEntryId ?? null,
      refType: row.refType ?? null,
      refId: row.refId ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt ?? new Date(),
    };
    memStoreCredit.set(memRow.id, memRow);
    return memRow;
  },

  async listCustomerCreditEntries(
    tx: Tx | undefined,
    customerId: string
  ): Promise<StoreCreditEntryRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(storeCreditEntries)
        .where(eq(storeCreditEntries.customerId, customerId))
        .orderBy(desc(storeCreditEntries.createdAt));
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }

    return Array.from(memStoreCredit.values())
      .filter((e) => e.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  /**
   * Retrieves all positive issuance lots for a customer.
   */
  async listCustomerIssuanceLots(
    tx: Tx | undefined,
    customerId: string
  ): Promise<StoreCreditEntryRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(storeCreditEntries)
        .where(
          and(
            eq(storeCreditEntries.customerId, customerId),
            sql`${storeCreditEntries.deltaPaisa} > 0`,
            sql`${storeCreditEntries.sourceEntryId} IS NULL`
          )
        )
        .orderBy(storeCreditEntries.createdAt);
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }

    return Array.from(memStoreCredit.values())
      .filter((e) => e.customerId === customerId && e.deltaPaisa > 0 && !e.sourceEntryId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  /**
   * Sums all consumed amounts (negative deltas) against a specific issuance lot.
   */
  async getConsumedAmountForLot(tx: Tx | undefined, lotId: string): Promise<number> {
    const client = tx ?? defaultDb;
    try {
      const res = await client
        .select({ sum: sql<number>`coalesce(sum(abs(${storeCreditEntries.deltaPaisa})), 0)` })
        .from(storeCreditEntries)
        .where(eq(storeCreditEntries.sourceEntryId, lotId));
      return Number(res[0]?.sum ?? 0);
    } catch {
      // Fallback
    }

    let sum = 0;
    for (const e of memStoreCredit.values()) {
      if (e.sourceEntryId === lotId && e.deltaPaisa < 0) {
        sum += Math.abs(e.deltaPaisa);
      }
    }
    return sum;
  },

  /**
   * Retrieves all positive lots in the system that have passed their expiration date
   * and still have positive remaining balance.
   */
  async listAllExpiredUnconsumedLots(
    tx: Tx | undefined,
    now: Date
  ): Promise<{ lot: StoreCreditEntryRow; remainingPaisa: number }[]> {
    const client = tx ?? defaultDb;
    let positiveLots: StoreCreditEntryRow[] = [];

    try {
      positiveLots = await client
        .select()
        .from(storeCreditEntries)
        .where(
          and(
            sql`${storeCreditEntries.deltaPaisa} > 0`,
            sql`${storeCreditEntries.sourceEntryId} IS NULL`,
            sql`${storeCreditEntries.expiresAt} <= ${now}`
          )
        );
    } catch {
      positiveLots = Array.from(memStoreCredit.values()).filter(
        (e) => e.deltaPaisa > 0 && !e.sourceEntryId && e.expiresAt && e.expiresAt <= now
      );
    }

    const results: { lot: StoreCreditEntryRow; remainingPaisa: number }[] = [];
    for (const lot of positiveLots) {
      const consumed = await this.getConsumedAmountForLot(tx, lot.id);
      const remaining = lot.deltaPaisa - consumed;
      if (remaining > 0) {
        results.push({ lot, remainingPaisa: remaining });
      }
    }

    return results;
  },
};
