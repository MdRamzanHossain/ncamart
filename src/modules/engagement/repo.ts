import { eq, and, sql, desc, isNull, or, lte, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { uuidv7 } from "@/lib/ids";
import {
  reviews,
  ReviewRow,
  InsertReviewRow,
  ReviewStatus,
  wishlistItems,
  WishlistItemRow,
  stockAlertSubscriptions,
  StockAlertSubscriptionRow,
  StockAlertStatus,
  carts,
  CartRow,
  CartItemData,
} from "./schema";
import { RatingSummaryDto } from "./dto";

// --------------------------------------------------------------------------
// In-Memory Fallback Stores for Tests & Offline Environments
// --------------------------------------------------------------------------
const memReviews = new Map<string, ReviewRow>();
const memWishlist = new Map<string, WishlistItemRow>();
const memStockAlerts = new Map<string, StockAlertSubscriptionRow>();
const memCarts = new Map<string, CartRow>();

// Memory store for mock order items / orders for eligibility testing
export interface MockOrderItemDeliveredInfo {
  id: string;
  orderId: string;
  customerId: string;
  productId: string;
  skuId: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  orderStatus: string;
}
const memMockOrderItems = new Map<string, MockOrderItemDeliveredInfo>();

export const engagementRepo = {
  // ------------------------------------------------------------------------
  // Reviews
  // ------------------------------------------------------------------------
  async createReview(data: InsertReviewRow): Promise<ReviewRow> {
    const rowId = data.id || uuidv7();
    const now = new Date();
    const row: ReviewRow = {
      id: rowId,
      orderItemId: data.orderItemId,
      customerId: data.customerId,
      productId: data.productId,
      skuId: data.skuId,
      tier: data.tier as "AUTHENTIC" | "BUDGET_SMART",
      rating: data.rating,
      title: data.title ?? null,
      body: data.body,
      mediaIds: data.mediaIds || [],
      status: data.status || "PENDING",
      moderatedBy: data.moderatedBy ?? null,
      moderatedAt: data.moderatedAt ?? null,
      rejectionReason: data.rejectionReason ?? null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const [inserted] = await db.insert(reviews).values(row).returning();
      if (inserted) return inserted;
    } catch {
      // Memory fallback
    }

    memReviews.set(rowId, row);
    return row;
  },

  async getReviewById(id: string): Promise<ReviewRow | null> {
    try {
      const [row] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memReviews.get(id) ?? null;
  },

  async getReviewByOrderItemId(orderItemId: string): Promise<ReviewRow | null> {
    try {
      const [row] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.orderItemId, orderItemId))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    for (const r of memReviews.values()) {
      if (r.orderItemId === orderItemId) return r;
    }
    return null;
  },

  async listApprovedReviewsByProductId(productId: string): Promise<ReviewRow[]> {
    try {
      const rows = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.productId, productId), eq(reviews.status, "APPROVED")))
        .orderBy(desc(reviews.createdAt));
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    const list: ReviewRow[] = [];
    for (const r of memReviews.values()) {
      if (r.productId === productId && r.status === "APPROVED") {
        list.push(r);
      }
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  },

  async listReviewsForModeration(status?: ReviewStatus, limit = 50, offset = 0): Promise<ReviewRow[]> {
    try {
      const query = db.select().from(reviews);
      if (status) {
        query.where(eq(reviews.status, status));
      }
      query.orderBy(desc(reviews.createdAt)).limit(limit).offset(offset);
      const rows = await query;
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    const list: ReviewRow[] = [];
    for (const r of memReviews.values()) {
      if (!status || r.status === status) {
        list.push(r);
      }
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.slice(offset, offset + limit);
  },

  async updateReviewModeration(
    id: string,
    status: ReviewStatus,
    moderatedBy: string,
    reason?: string
  ): Promise<ReviewRow | null> {
    const now = new Date();
    try {
      const [updated] = await db
        .update(reviews)
        .set({
          status,
          moderatedBy,
          moderatedAt: now,
          rejectionReason: reason ?? null,
          updatedAt: now,
        })
        .where(eq(reviews.id, id))
        .returning();
      if (updated) return updated;
    } catch {
      // Memory fallback
    }

    const mem = memReviews.get(id);
    if (mem) {
      mem.status = status;
      mem.moderatedBy = moderatedBy;
      mem.moderatedAt = now;
      mem.rejectionReason = reason ?? null;
      mem.updatedAt = now;
      return mem;
    }
    return null;
  },

  async computeProductRatingSummary(productId: string): Promise<RatingSummaryDto> {
    const approvedReviews = await this.listApprovedReviewsByProductId(productId);
    const total = approvedReviews.length;
    const distribution: { 1: number; 2: number; 3: number; 4: number; 5: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    if (total === 0) {
      return {
        average_rating: 0,
        total_reviews: 0,
        distribution,
      };
    }

    let sum = 0;
    for (const r of approvedReviews) {
      const score = Math.max(1, Math.min(5, r.rating)) as 1 | 2 | 3 | 4 | 5;
      distribution[score] = (distribution[score] || 0) + 1;
      sum += score;
    }

    const average_rating = Number((sum / total).toFixed(1));
    return {
      average_rating,
      total_reviews: total,
      distribution,
    };
  },

  // ------------------------------------------------------------------------
  // Wishlist
  // ------------------------------------------------------------------------
  async addWishlistItem(
    customerId: string,
    productId: string,
    skuId?: string | null
  ): Promise<WishlistItemRow> {
    const cleanSku = skuId || null;
    const key = `${customerId}:${productId}:${cleanSku || "none"}`;
    const now = new Date();

    const row: WishlistItemRow = {
      id: uuidv7(),
      customerId,
      productId,
      skuId: cleanSku,
      createdAt: now,
    };

    try {
      const [inserted] = await db
        .insert(wishlistItems)
        .values(row)
        .onConflictDoNothing()
        .returning();
      if (inserted) return inserted;
    } catch {
      // Memory fallback
    }

    if (!memWishlist.has(key)) {
      memWishlist.set(key, row);
    }
    return memWishlist.get(key)!;
  },

  async removeWishlistItem(
    customerId: string,
    productId: string,
    skuId?: string | null
  ): Promise<boolean> {
    const cleanSku = skuId || null;
    const key = `${customerId}:${productId}:${cleanSku || "none"}`;

    try {
      await db
        .delete(wishlistItems)
        .where(
          and(
            eq(wishlistItems.customerId, customerId),
            eq(wishlistItems.productId, productId),
            cleanSku ? eq(wishlistItems.skuId, cleanSku) : isNull(wishlistItems.skuId)
          )
        );
    } catch {
      // Memory fallback
    }

    const deleted = memWishlist.delete(key);
    // Also try removing product-wide if skuId not specified
    if (!cleanSku) {
      for (const [k, v] of memWishlist.entries()) {
        if (v.customerId === customerId && v.productId === productId) {
          memWishlist.delete(k);
        }
      }
    }
    return deleted;
  },

  async listWishlistItems(customerId: string): Promise<WishlistItemRow[]> {
    try {
      const rows = await db
        .select()
        .from(wishlistItems)
        .where(eq(wishlistItems.customerId, customerId))
        .orderBy(desc(wishlistItems.createdAt));
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    const list: WishlistItemRow[] = [];
    for (const item of memWishlist.values()) {
      if (item.customerId === customerId) {
        list.push(item);
      }
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  },

  // ------------------------------------------------------------------------
  // Stock Alert Subscriptions
  // ------------------------------------------------------------------------
  async createStockAlertSubscription(
    customerId: string,
    skuId: string
  ): Promise<StockAlertSubscriptionRow> {
    const now = new Date();
    const row: StockAlertSubscriptionRow = {
      id: uuidv7(),
      customerId,
      skuId,
      status: "ACTIVE",
      createdAt: now,
      notifiedAt: null,
    };

    try {
      const [inserted] = await db.insert(stockAlertSubscriptions).values(row).returning();
      if (inserted) return inserted;
    } catch {
      // Memory fallback
    }

    memStockAlerts.set(row.id, row);
    return row;
  },

  async getActiveStockAlertSubscription(
    customerId: string,
    skuId: string
  ): Promise<StockAlertSubscriptionRow | null> {
    try {
      const [row] = await db
        .select()
        .from(stockAlertSubscriptions)
        .where(
          and(
            eq(stockAlertSubscriptions.customerId, customerId),
            eq(stockAlertSubscriptions.skuId, skuId),
            eq(stockAlertSubscriptions.status, "ACTIVE")
          )
        )
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }

    for (const sub of memStockAlerts.values()) {
      if (sub.customerId === customerId && sub.skuId === skuId && sub.status === "ACTIVE") {
        return sub;
      }
    }
    return null;
  },

  async listActiveSubscriptionsBySkuId(skuId: string): Promise<StockAlertSubscriptionRow[]> {
    try {
      const rows = await db
        .select()
        .from(stockAlertSubscriptions)
        .where(
          and(
            eq(stockAlertSubscriptions.skuId, skuId),
            eq(stockAlertSubscriptions.status, "ACTIVE")
          )
        );
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    const list: StockAlertSubscriptionRow[] = [];
    for (const sub of memStockAlerts.values()) {
      if (sub.skuId === skuId && sub.status === "ACTIVE") {
        list.push(sub);
      }
    }
    return list;
  },

  async markStockAlertNotified(id: string, notifiedAt = new Date()): Promise<void> {
    try {
      await db
        .update(stockAlertSubscriptions)
        .set({ status: "NOTIFIED", notifiedAt })
        .where(eq(stockAlertSubscriptions.id, id));
    } catch {
      // Memory fallback
    }

    const sub = memStockAlerts.get(id);
    if (sub) {
      sub.status = "NOTIFIED";
      sub.notifiedAt = notifiedAt;
    }
  },

  // ------------------------------------------------------------------------
  // Server-Side Carts
  // ------------------------------------------------------------------------
  async upsertCart(customerId: string, items: CartItemData[]): Promise<CartRow> {
    const now = new Date();
    const row: CartRow = {
      customerId,
      items,
      updatedAt: now,
      remindedAt: null,
    };

    try {
      const [inserted] = await db
        .insert(carts)
        .values(row)
        .onConflictDoUpdate({
          target: carts.customerId,
          set: {
            items,
            updatedAt: now,
          },
        })
        .returning();
      if (inserted) return inserted;
    } catch {
      // Memory fallback
    }

    const existing = memCarts.get(customerId);
    const updated: CartRow = {
      customerId,
      items,
      updatedAt: now,
      remindedAt: existing ? existing.remindedAt : null,
    };
    memCarts.set(customerId, updated);
    return updated;
  },

  async getCart(customerId: string): Promise<CartRow | null> {
    try {
      const [row] = await db.select().from(carts).where(eq(carts.customerId, customerId)).limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memCarts.get(customerId) ?? null;
  },

  async clearCart(customerId: string): Promise<void> {
    try {
      await db.delete(carts).where(eq(carts.customerId, customerId));
    } catch {
      // Memory fallback
    }
    memCarts.delete(customerId);
  },

  async updateCartReminded(customerId: string, remindedAt = new Date()): Promise<void> {
    try {
      await db
        .update(carts)
        .set({ remindedAt })
        .where(eq(carts.customerId, customerId));
    } catch {
      // Memory fallback
    }

    const cart = memCarts.get(customerId);
    if (cart) {
      cart.remindedAt = remindedAt;
    }
  },

  async listAbandonedCarts(params: {
    minAgeMs: number;
    maxAgeMs: number;
    minReminderAgeMs: number;
    now: Date;
  }): Promise<CartRow[]> {
    const nowTime = params.now.getTime();
    const minUpdated = new Date(nowTime - params.maxAgeMs);
    const maxUpdated = new Date(nowTime - params.minAgeMs);
    const reminderCutoff = new Date(nowTime - params.minReminderAgeMs);

    try {
      const rows = await db
        .select()
        .from(carts)
        .where(
          and(
            gte(carts.updatedAt, minUpdated),
            lte(carts.updatedAt, maxUpdated),
            or(isNull(carts.remindedAt), lte(carts.remindedAt, reminderCutoff))
          )
        );
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    const list: CartRow[] = [];
    for (const c of memCarts.values()) {
      if (!c.items || c.items.length === 0) continue;
      const updatedTime = new Date(c.updatedAt).getTime();
      const isAgeMatch = updatedTime >= minUpdated.getTime() && updatedTime <= maxUpdated.getTime();
      const isReminderMatch =
        !c.remindedAt || new Date(c.remindedAt).getTime() <= reminderCutoff.getTime();

      if (isAgeMatch && isReminderMatch) {
        list.push(c);
      }
    }
    return list;
  },

  // ------------------------------------------------------------------------
  // Order Item Lookup & Mocking
  // ------------------------------------------------------------------------
  setMockOrderItem(info: MockOrderItemDeliveredInfo): void {
    memMockOrderItems.set(info.id, info);
  },

  getMockOrderItem(orderItemId: string): MockOrderItemDeliveredInfo | null {
    return memMockOrderItems.get(orderItemId) ?? null;
  },

  clearMemoryEngagementForTesting(): void {
    memReviews.clear();
    memWishlist.clear();
    memStockAlerts.clear();
    memCarts.clear();
    memMockOrderItems.clear();
  },
};
