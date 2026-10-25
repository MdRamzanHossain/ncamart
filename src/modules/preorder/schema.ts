import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { orders } from "@/modules/orders/schema";
import { skus } from "@/modules/catalog/schema";
import { customers } from "@/modules/identity/schema";

export const supportTaskTypeEnum = [
  "PREORDER_BALANCE_CALL",
  "DELETION_REQUEST",
  "DORMANT_PHONE_REVIEW",
  "GENERAL",
] as const;
export type SupportTaskType = (typeof supportTaskTypeEnum)[number];

export const supportTaskStatusEnum = [
  "PENDING",
  "ASSIGNED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type SupportTaskStatus = (typeof supportTaskStatusEnum)[number];

export const supportTasks = pgTable(
  "support_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type", { enum: supportTaskTypeEnum }).notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: supportTaskStatusEnum })
      .default("PENDING")
      .notNull(),
    assignedTo: uuid("assigned_to"),
    resolutionNotes: text("resolution_notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_support_tasks_order_id").on(table.orderId),
    index("idx_support_tasks_customer_id").on(table.customerId),
    index("idx_support_tasks_status_due").on(table.status, table.dueAt),
  ]
);

export type SupportTaskRow = typeof supportTasks.$inferSelect;
export type InsertSupportTaskRow = typeof supportTasks.$inferInsert;

export const flashDealStatusEnum = ["ACTIVE", "EXPIRED", "DEPLETED"] as const;
export type FlashDealStatus = (typeof flashDealStatusEnum)[number];

export const flashDeals = pgTable(
  "flash_deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => skus.id),
    qty: integer("qty").notNull(),
    pricePaisa: bigint("price_paisa", { mode: "number" }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: flashDealStatusEnum })
      .default("ACTIVE")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_flash_deals_sku_status").on(table.skuId, table.status),
    index("idx_flash_deals_dates").on(table.startsAt, table.endsAt),
  ]
);

export type FlashDealRow = typeof flashDeals.$inferSelect;
export type InsertFlashDealRow = typeof flashDeals.$inferInsert;
