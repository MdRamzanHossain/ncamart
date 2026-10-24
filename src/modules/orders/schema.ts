import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { customers } from "../identity/schema";
import { products, skus } from "../catalog/schema";
import { locations } from "../inventory/schema";
import { coupons } from "../promotions/schema";

// Enums as const arrays
export const orderChannelEnum = [
  "STOREFRONT_WEB",
  "SHOWROOM_POS",
  "PHONE_ORDER",
] as const;
export type OrderChannel = (typeof orderChannelEnum)[number];

export const orderTypeEnum = ["REGULAR_DROP_PACK", "PRE_ORDER"] as const;
export type OrderType = (typeof orderTypeEnum)[number];

export const fulfillmentChannelEnum = [
  "COURIER",
  "PICKUP",
  "WALK_IN",
] as const;
export type FulfillmentChannel = (typeof fulfillmentChannelEnum)[number];

export const deliveryZoneEnum = ["INSIDE_DHAKA", "OUTSIDE_DHAKA"] as const;
export type DeliveryZone = (typeof deliveryZoneEnum)[number];

export const orderStatusEnum = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "SOURCING",
  "AT_GODOWN_QC",
  "PACKED",
  "HANDED_TO_COURIER",
  "DELIVERED",
  "PARTIALLY_DELIVERED",
  "RTO_IN_TRANSIT",
  "RTO_RECEIVED",
  "READY_FOR_PICKUP",
  "DELIVERED_COUNTER",
  "PICKUP_EXPIRED",
  "CANCELLED",
  // Pre-order specific statuses
  "DEPOSIT_PENDING",
  "DEPOSIT_PAID",
  "SOURCED_IN_TRANSIT",
  "REPRICING_PENDING",
  "ARRIVED_GODOWN",
  "QC_VERIFIED_BALANCE_DUE",
  "BALANCE_PAID",
  "BALANCE_COD_SCHEDULED",
  "BALANCE_COUNTER_SCHEDULED",
  "DEPOSIT_FORFEITED_CANCELLED",
  "CANCELLED_REFUNDED",
] as const;
export type OrderStatus = (typeof orderStatusEnum)[number];

export const paymentStatusEnum = [
  "UNPAID",
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "FAILED",
] as const;
export type PaymentStatus = (typeof paymentStatusEnum)[number];

export const paymentModeEnum = [
  "ONLINE_FULL",
  "COD",
  "PAY_AT_COUNTER",
  "PREORDER_DEPOSIT",
] as const;
export type PaymentMode = (typeof paymentModeEnum)[number];

export const advancePurposeEnum = [
  "DELIVERY_FEE",
  "DEPOSIT",
  "FULL",
] as const;
export type AdvancePurpose = (typeof advancePurposeEnum)[number];

export const itemSourceEnum = ["PHYSICAL", "VIRTUAL"] as const;
export type ItemSource = (typeof itemSourceEnum)[number];

export const orderItemStatusEnum = [
  "ACTIVE",
  "CANCELLED",
  "DELIVERED",
  "RETURNED",
  "RTO",
] as const;
export type OrderItemStatus = (typeof orderItemStatusEnum)[number];

export const unitStatusEnum = [
  "PENDING",
  "ALLOCATED",
  "SEALED",
  "DELIVERED",
  "RETURNED",
  "RTO",
] as const;
export type UnitStatus = (typeof unitStatusEnum)[number];

export const orderActorTypeEnum = ["CUSTOMER", "STAFF", "SYSTEM"] as const;
export type OrderActorType = (typeof orderActorTypeEnum)[number];

export const preOrderMilestoneEnum = [
  "DEPOSIT_PENDING",
  "DEPOSIT_PAID",
  "SOURCED_IN_TRANSIT",
  "ARRIVED_GODOWN",
  "QC_VERIFIED",
  "BALANCE_PAID",
  "DISPATCHED",
  "DELIVERED",
  "IMPORT_FAILED",
] as const;
export type PreOrderMilestone = (typeof preOrderMilestoneEnum)[number];

export const repricingStatusEnum = [
  "NONE",
  "PENDING",
  "ACCEPTED",
  "REJECTED",
] as const;
export type RepricingStatus = (typeof repricingStatusEnum)[number];

export const delayOptionEnum = [
  "NONE",
  "OFFERED",
  "CANCELLED",
  "KEPT",
  "KEPT_WITH_CREDIT",
] as const;
export type DelayOption = (typeof delayOptionEnum)[number];

export const paymentPurposeEnum = [
  "FULL",
  "ADVANCE_FEE",
  "DEPOSIT",
  "BALANCE",
] as const;
export type PaymentPurpose = (typeof paymentPurposeEnum)[number];

export const paymentMethodEnum = [
  "SSLCOMMERZ",
  "CASH_COUNTER",
  "BKASH_QR",
  "NAGAD_QR",
  "CARD_TERMINAL",
  "COURIER_COD",
  "STORE_CREDIT",
] as const;
export type PaymentMethod = (typeof paymentMethodEnum)[number];

export const paymentTransactionStatusEnum = [
  "INITIATED",
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "HOLD_REVIEW",
  "EXPIRED",
] as const;
export type PaymentTransactionStatus =
  (typeof paymentTransactionStatusEnum)[number];

export interface AddressSnapshot {
  consignee: string;
  phone: string;
  divisionId?: string;
  divisionName?: string;
  districtId?: string;
  districtName?: string;
  thanaId?: string;
  thanaName?: string;
  areaId?: string;
  areaName?: string;
  addressLine: string;
  isInsideDhaka: boolean;
}

// 1. Orders Table
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    channel: text("channel", { enum: orderChannelEnum }).notNull(),
    orderType: text("order_type", { enum: orderTypeEnum }).notNull(),
    fulfillmentChannel: text("fulfillment_channel", {
      enum: fulfillmentChannelEnum,
    }).notNull(),
    deliveryZone: text("delivery_zone", { enum: deliveryZoneEnum }),
    status: text("status", { enum: orderStatusEnum }).notNull(),
    paymentStatus: text("payment_status", { enum: paymentStatusEnum })
      .default("UNPAID")
      .notNull(),
    paymentMode: text("payment_mode", { enum: paymentModeEnum }).notNull(),
    addressSnapshot: jsonb("address_snapshot").$type<AddressSnapshot | null>(),
    subtotalPaisa: bigint("subtotal_paisa", { mode: "number" }).notNull(),
    discountPaisa: bigint("discount_paisa", { mode: "number" })
      .default(0)
      .notNull(),
    deliveryFeePaisa: bigint("delivery_fee_paisa", { mode: "number" })
      .default(0)
      .notNull(),
    vatTotalPaisa: bigint("vat_total_paisa", { mode: "number" })
      .default(0)
      .notNull(),
    totalPayablePaisa: bigint("total_payable_paisa", { mode: "number" }).notNull(),
    storeCreditAppliedPaisa: bigint("store_credit_applied_paisa", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    advanceRequiredPaisa: bigint("advance_required_paisa", { mode: "number" })
      .default(0)
      .notNull(),
    advancePaidPaisa: bigint("advance_paid_paisa", { mode: "number" })
      .default(0)
      .notNull(),
    advancePurpose: text("advance_purpose", { enum: advancePurposeEnum }),
    codAmountPaisa: bigint("cod_amount_paisa", { mode: "number" })
      .default(0)
      .notNull(),
    paidTotalPaisa: bigint("paid_total_paisa", { mode: "number" })
      .default(0)
      .notNull(),
    refundedTotalPaisa: bigint("refunded_total_paisa", { mode: "number" })
      .default(0)
      .notNull(),
    couponId: uuid("coupon_id").references(() => coupons.id),
    mushakRequested: boolean("mushak_requested").default(false).notNull(),
    buyerCompanyName: text("buyer_company_name"),
    buyerBin: text("buyer_bin"),
    pickupPinHash: text("pickup_pin_hash"),
    pickupPinExpiresAt: timestamp("pickup_pin_expires_at", {
      withTimezone: true,
    }),
    pickupPinAttempts: integer("pickup_pin_attempts").default(0).notNull(),
    pickupPinLocked: boolean("pickup_pin_locked").default(false).notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_orders_customer_created").on(table.customerId, table.createdAt),
    index("idx_orders_status_type").on(table.status, table.orderType),
    index("idx_orders_payment_status").on(table.paymentStatus),
    index("idx_orders_order_number").on(table.orderNumber),
  ]
);

export type OrderRow = typeof orders.$inferSelect;
export type InsertOrderRow = typeof orders.$inferInsert;

// 2. Order Items Table
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => skus.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    titleEn: text("title_en").notNull(),
    titleBn: text("title_bn").notNull(),
    tier: text("tier").notNull(),
    skuCode: text("sku_code").notNull(),
    qty: integer("qty").notNull(),
    unitPricePaisa: bigint("unit_price_paisa", { mode: "number" }).notNull(),
    allocatedDiscountPaisa: bigint("allocated_discount_paisa", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    lineTotalPaisa: bigint("line_total_paisa", { mode: "number" }).notNull(),
    vatRateBp: integer("vat_rate_bp").notNull(),
    vatPaisa: bigint("vat_paisa", { mode: "number" }).notNull(),
    unitCostPaisa: bigint("unit_cost_paisa", { mode: "number" }),
    source: text("source", { enum: itemSourceEnum }).notNull(),
    sourceLocationId: uuid("source_location_id").references(
      () => locations.id
    ),
    status: text("status", { enum: orderItemStatusEnum })
      .default("ACTIVE")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_order_items_order_id").on(table.orderId),
    index("idx_order_items_sku_id").on(table.skuId),
    check("order_items_qty_check", sql`${table.qty} > 0`),
  ]
);

export type OrderItemRow = typeof orderItems.$inferSelect;
export type InsertOrderItemRow = typeof orderItems.$inferInsert;

// 3. Order Item Units Table (One row per physical unit for P26 holographic seals)
export const orderItemUnits = pgTable(
  "order_item_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    unitIndex: integer("unit_index").notNull(),
    sealId: text("seal_id"),
    manufacturerSerial: text("manufacturer_serial"),
    status: text("status", { enum: unitStatusEnum })
      .default("PENDING")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_order_item_units_item_id").on(table.orderItemId),
    index("idx_order_item_units_seal_id").on(table.sealId),
  ]
);

export type OrderItemUnitRow = typeof orderItemUnits.$inferSelect;
export type InsertOrderItemUnitRow = typeof orderItemUnits.$inferInsert;

// 4. Order Status History Table (Append-only)
export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorType: text("actor_type", { enum: orderActorTypeEnum }).notNull(),
    actorId: uuid("actor_id"),
    reason: text("reason"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_order_status_history_order").on(table.orderId, table.createdAt),
  ]
);

export type OrderStatusHistoryRow = typeof orderStatusHistory.$inferSelect;
export type InsertOrderStatusHistoryRow = typeof orderStatusHistory.$inferInsert;

// 5. Pre-Orders Table
export const preOrders = pgTable(
  "pre_orders",
  {
    orderId: uuid("order_id")
      .primaryKey()
      .references(() => orders.id, { onDelete: "cascade" }),
    depositPaisa: bigint("deposit_paisa", { mode: "number" }).notNull(),
    balancePaisa: bigint("balance_paisa", { mode: "number" }).notNull(),
    etaDate: timestamp("eta_date", { withTimezone: true }).notNull(),
    etaMinDays: integer("eta_min_days").notNull(),
    etaMaxDays: integer("eta_max_days").notNull(),
    priceLockedPaisa: bigint("price_locked_paisa", { mode: "number" }).notNull(),
    milestone: text("milestone", { enum: preOrderMilestoneEnum }).notNull(),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    qcVerifiedAt: timestamp("qc_verified_at", { withTimezone: true }),
    balanceDueDate: timestamp("balance_due_date", { withTimezone: true }),
    forfeitureDate: timestamp("forfeiture_date", { withTimezone: true }),
    repricingStatus: text("repricing_status", { enum: repricingStatusEnum })
      .default("NONE")
      .notNull(),
    repricingNewTotalPaisa: bigint("repricing_new_total_paisa", {
      mode: "number",
    }),
    repricingDeadline: timestamp("repricing_deadline", { withTimezone: true }),
    delayOption: text("delay_option", { enum: delayOptionEnum })
      .default("NONE")
      .notNull(),
    delayOfferedAt: timestamp("delay_offered_at", { withTimezone: true }),
    batchKey: text("batch_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

export type PreOrderRow = typeof preOrders.$inferSelect;
export type InsertPreOrderRow = typeof preOrders.$inferInsert;

// 6. Payment Transactions Table
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tranId: text("tran_id").notNull().unique(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    purpose: text("purpose", { enum: paymentPurposeEnum }).notNull(),
    method: text("method", { enum: paymentMethodEnum }).notNull(),
    amountPaisa: bigint("amount_paisa", { mode: "number" }).notNull(),
    currency: text("currency").default("BDT").notNull(),
    status: text("status", { enum: paymentTransactionStatusEnum })
      .default("INITIATED")
      .notNull(),
    gatewaySessionKey: text("gateway_session_key"),
    valId: text("val_id"),
    bankTranId: text("bank_tran_id"),
    cardType: text("card_type"),
    riskLevel: text("risk_level"),
    riskTitle: text("risk_title"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    rawIpn: jsonb("raw_ipn").$type<Record<string, unknown> | null>(),
    rawValidation: jsonb("raw_validation").$type<Record<string, unknown> | null>(),
    externalRef: text("external_ref"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_payment_transactions_order").on(table.orderId),
    index("idx_payment_transactions_status").on(table.status),
    index("idx_payment_transactions_customer").on(table.customerId),
  ]
);

export type PaymentTransactionRow = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransactionRow =
  typeof paymentTransactions.$inferInsert;

// 7. Cart Holds Table (10-minute pre-checkout stock hold)
export const cartHoldStatusEnum = [
  "ACTIVE",
  "CONVERTED",
  "RELEASED",
  "EXPIRED",
] as const;
export type CartHoldStatus = (typeof cartHoldStatusEnum)[number];

export const cartHolds = pgTable(
  "cart_holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deviceId: text("device_id").notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: cartHoldStatusEnum })
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
    index("idx_cart_holds_device_id").on(table.deviceId),
    index("idx_cart_holds_status_expires").on(table.status, table.expiresAt),
  ]
);

export type CartHoldRow = typeof cartHolds.$inferSelect;
export type InsertCartHoldRow = typeof cartHolds.$inferInsert;

// 8. Order Notes Table (Staff internal notes)
export const orderNotes = pgTable(
  "order_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull(),
    staffName: text("staff_name"),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_order_notes_order_id").on(table.orderId),
  ]
);

export type OrderNoteRow = typeof orderNotes.$inferSelect;
export type InsertOrderNoteRow = typeof orderNotes.$inferInsert;

