import {
  pgTable,
  uuid,
  text,
  bigint,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const couponTypeEnum = ["FIXED", "PERCENT"] as const;
export type CouponType = (typeof couponTypeEnum)[number];

export const couponScopeTypeEnum = ["ALL", "TIER", "CATEGORY", "SKU"] as const;
export type CouponScopeType = (typeof couponScopeTypeEnum)[number];

export const couponStatusEnum = ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED"] as const;
export type CouponStatus = (typeof couponStatusEnum)[number];

export const couponRedemptionStatusEnum = ["RESERVED", "CONFIRMED", "RELEASED"] as const;
export type CouponRedemptionStatus = (typeof couponRedemptionStatusEnum)[number];

export const storeCreditReasonEnum = [
  "GOODWILL",
  "PREORDER_DELAY",
  "RMA_RESOLUTION",
  "REFUND_AS_CREDIT",
  "APPLIED_TO_ORDER",
  "REVERSAL",
  "EXPIRY",
  "WITHDRAWAL",
] as const;
export type StoreCreditReason = (typeof storeCreditReasonEnum)[number];

// 1. Coupons Table
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(), // Uppercase enforced
    type: text("type", { enum: couponTypeEnum }).notNull(),
    value: bigint("value", { mode: "number" }).notNull(), // Paisa if FIXED, basis points if PERCENT
    minOrderPaisa: bigint("min_order_paisa", { mode: "number" }).default(0).notNull(),
    maxDiscountPaisa: bigint("max_discount_paisa", { mode: "number" }),
    scopeType: text("scope_type", { enum: couponScopeTypeEnum }).default("ALL").notNull(),
    scopeValues: text("scope_values").array(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    usageLimit: integer("usage_limit"),
    perPhoneLimit: integer("per_phone_limit").default(1).notNull(),
    status: text("status", { enum: couponStatusEnum }).default("DRAFT").notNull(),
    createdBy: uuid("created_by").notNull(),
    activatedBy: uuid("activated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_coupons_code").on(table.code),
    index("idx_coupons_status").on(table.status),
    index("idx_coupons_dates").on(table.startsAt, table.endsAt),
  ]
);

export type CouponRow = typeof coupons.$inferSelect;
export type InsertCouponRow = typeof coupons.$inferInsert;

// 2. Coupon Redemptions Table
export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").notNull().unique(),
    customerId: uuid("customer_id"),
    phone: text("phone").notNull(),
    discountPaisa: bigint("discount_paisa", { mode: "number" }).notNull(),
    status: text("status", { enum: couponRedemptionStatusEnum }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_coupon_redemptions_order").on(table.orderId),
    index("idx_coupon_redemptions_coupon_status").on(table.couponId, table.status),
    index("idx_coupon_redemptions_phone").on(table.couponId, table.phone, table.status),
  ]
);

export type CouponRedemptionRow = typeof couponRedemptions.$inferSelect;
export type InsertCouponRedemptionRow = typeof couponRedemptions.$inferInsert;

// 3. Store Credit Entries Table (Append-Only)
export const storeCreditEntries = pgTable(
  "store_credit_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").notNull(),
    deltaPaisa: bigint("delta_paisa", { mode: "number" }).notNull(), // signed amount (+/-)
    reason: text("reason", { enum: storeCreditReasonEnum }).notNull(),
    withdrawable: boolean("withdrawable").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    sourceEntryId: uuid("source_entry_id"), // for consumption tracking
    refType: text("ref_type"),
    refId: text("ref_id"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_store_credit_customer").on(table.customerId),
    index("idx_store_credit_source").on(table.sourceEntryId),
    index("idx_store_credit_expires").on(table.expiresAt),
    index("idx_store_credit_created_at").on(table.createdAt),
  ]
);

export type StoreCreditEntryRow = typeof storeCreditEntries.$inferSelect;
export type InsertStoreCreditEntryRow = typeof storeCreditEntries.$inferInsert;
