import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { customers } from "../identity/schema";
import { products, skus } from "../catalog/schema";
import { orderItems } from "../orders/schema";

// --------------------------------------------------------------------------
// Enums
// --------------------------------------------------------------------------
export const reviewStatusEnum = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ReviewStatus = (typeof reviewStatusEnum)[number];

export const stockAlertStatusEnum = ["ACTIVE", "NOTIFIED", "CANCELLED"] as const;
export type StockAlertStatus = (typeof stockAlertStatusEnum)[number];

// --------------------------------------------------------------------------
// 1. Verified Reviews Table
// reviews(id, order_item_id unique, customer_id, product_id, sku_id, tier,
// rating 1–5, title, body, media_ids, status ('PENDING'|'APPROVED'|'REJECTED'),
// moderated_by, moderated_at, created_at)
// --------------------------------------------------------------------------
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => skus.id),
    tier: text("tier", { enum: ["AUTHENTIC", "BUDGET_SMART"] }).notNull(),
    rating: integer("rating").notNull(), // 1 to 5
    title: text("title"),
    body: text("body").notNull(),
    mediaIds: jsonb("media_ids").$type<string[]>().default([]).notNull(),
    status: text("status", { enum: reviewStatusEnum }).default("PENDING").notNull(),
    moderatedBy: text("moderated_by"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_reviews_order_item_id").on(table.orderItemId),
    index("idx_reviews_product_status").on(table.productId, table.status),
    index("idx_reviews_customer").on(table.customerId),
    index("idx_reviews_created_at").on(table.createdAt),
  ]
);

export type ReviewRow = typeof reviews.$inferSelect;
export type InsertReviewRow = typeof reviews.$inferInsert;

// --------------------------------------------------------------------------
// 2. Wishlist Items Table
// wishlist_items(customer_id, product_id, sku_id null, created_at) PK
// --------------------------------------------------------------------------
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    skuId: uuid("sku_id").references(() => skus.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_wishlist_customer").on(table.customerId),
    uniqueIndex("idx_wishlist_customer_product_sku").on(
      table.customerId,
      table.productId,
      table.skuId
    ),
  ]
);

export type WishlistItemRow = typeof wishlistItems.$inferSelect;
export type InsertWishlistItemRow = typeof wishlistItems.$inferInsert;

// --------------------------------------------------------------------------
// 3. Stock Alert Subscriptions Table
// stock_alert_subscriptions(id, customer_id, sku_id, status ('ACTIVE'|'NOTIFIED'|
// 'CANCELLED'), created_at, notified_at)
// --------------------------------------------------------------------------
export const stockAlertSubscriptions = pgTable(
  "stock_alert_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => skus.id),
    status: text("status", { enum: stockAlertStatusEnum }).default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_stock_alert_sku_status").on(table.skuId, table.status),
    index("idx_stock_alert_customer").on(table.customerId),
  ]
);

export type StockAlertSubscriptionRow = typeof stockAlertSubscriptions.$inferSelect;
export type InsertStockAlertSubscriptionRow = typeof stockAlertSubscriptions.$inferInsert;

// --------------------------------------------------------------------------
// 4. Server-Side Carts Table
// carts(customer_id pk, items jsonb, updated_at, reminded_at)
// --------------------------------------------------------------------------
export interface CartItemData {
  skuId: string;
  quantity: number;
  addedAt?: string;
  metadata?: Record<string, unknown>;
}

export const carts = pgTable(
  "carts",
  {
    customerId: uuid("customer_id")
      .primaryKey()
      .references(() => customers.id),
    items: jsonb("items").$type<CartItemData[]>().default([]).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_carts_updated_at").on(table.updatedAt),
    index("idx_carts_reminded_at").on(table.remindedAt),
  ]
);

export type CartRow = typeof carts.$inferSelect;
export type InsertCartRow = typeof carts.$inferInsert;
