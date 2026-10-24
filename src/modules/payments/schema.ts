import {
  pgTable,
  uuid,
  text,
  boolean,
  bigint,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { orders } from "@/modules/orders/schema";

export const refundReasonEnum = [
  "CUSTOMER_CANCELLATION",
  "STOCKOUT",
  "PREORDER_IMPORT_FAILED",
  "PREORDER_DELAY_CANCEL",
  "REPRICING_REJECTED",
  "RMA_REFUND",
  "OVERPAYMENT",
  "RTO_PREPAID_RETURN",
  "RISK_REJECTED",
  "STOCKOUT_AFTER_LATE_PAYMENT",
  "OTHER",
] as const;
export type RefundReason = (typeof refundReasonEnum)[number];

export const refundMethodEnum = [
  "GATEWAY",
  "BKASH",
  "NAGAD",
  "BANK",
  "STORE_CREDIT",
] as const;
export type RefundMethod = (typeof refundMethodEnum)[number];

export const refundStatusEnum = [
  "REQUESTED",
  "APPROVED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REJECTED",
] as const;
export type RefundStatus = (typeof refundStatusEnum)[number];

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refundNumber: text("refund_number").notNull().unique(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    orderItemIds: text("order_item_ids").array().default([]).notNull(),
    paymentTranId: text("payment_tran_id"),
    amountPaisa: bigint("amount_paisa", { mode: "number" }).notNull(),
    reason: text("reason", { enum: refundReasonEnum }).notNull(),
    method: text("method", { enum: refundMethodEnum }).notNull(),
    status: text("status", { enum: refundStatusEnum }).default("REQUESTED").notNull(),
    isBeforeDelivery: boolean("is_before_delivery").default(true).notNull(),
    requestedByType: text("requested_by_type").default("SYSTEM").notNull(), // SYSTEM, STAFF, CUSTOMER
    requestedById: text("requested_by_id"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    executedBy: text("executed_by"),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    externalRef: text("external_ref"),
    proofMediaId: text("proof_media_id"),
    gatewayRefundRef: text("gateway_refund_ref"),
    payoutAccount: text("payout_account"), // Encrypted with AES-256-GCM
    dueBy: timestamp("due_by", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_refunds_order_id").on(table.orderId),
    index("idx_refunds_status").on(table.status),
    index("idx_refunds_due_by").on(table.dueBy),
  ]
);

export type RefundRow = typeof refunds.$inferSelect;
export type InsertRefundRow = typeof refunds.$inferInsert;

export const refundEvents = pgTable(
  "refund_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refundId: uuid("refund_id")
      .notNull()
      .references(() => refunds.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_refund_events_refund_id").on(table.refundId),
    index("idx_refund_events_created_at").on(table.createdAt),
  ]
);

export type RefundEventRow = typeof refundEvents.$inferSelect;
export type InsertRefundEventRow = typeof refundEvents.$inferInsert;
