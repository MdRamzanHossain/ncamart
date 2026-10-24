import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Canonical Location Codes from P00
export const locationCodeEnum = [
  "GODOWN_NAWABPUR",
  "SHOWROOM_COUNTER",
  "QC_HOLD",
  "RMA_HOLD",
  "DAMAGED",
  "IN_TRANSIT",
] as const;
export type LocationCode = (typeof locationCodeEnum)[number];

export const stockMovementReasonEnum = [
  "PURCHASE_RECEIPT",
  "RUNNER_RECEIPT",
  "RUNNER_CONFLICT_RECEIPT",
  "SALE",
  "POS_SALE",
  "TRANSFER",
  "RTO_RETURN",
  "RMA_RETURN",
  "CANCELLATION_RECEIPT",
  "PREORDER_FORFEIT_RECEIPT",
  "SUPPLIER_RETURN",
  "WRITE_OFF",
  "CYCLE_COUNT_ADJUSTMENT",
  "QC_HOLD",
  "QC_RELEASE",
] as const;
export type StockMovementReason = (typeof stockMovementReasonEnum)[number];

export const stockReservationStatusEnum = [
  "ACTIVE",
  "COMMITTED",
  "RELEASED",
] as const;
export type StockReservationStatus = (typeof stockReservationStatusEnum)[number];

export const stockAdjustmentStatusEnum = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type StockAdjustmentStatus = (typeof stockAdjustmentStatusEnum)[number];

export const cycleCountStatusEnum = [
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type CycleCountStatus = (typeof cycleCountStatusEnum)[number];

// 1. Locations Table
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code", { enum: locationCodeEnum }).unique().notNull(),
    name: text("name").notNull(),
    isSellable: boolean("is_sellable").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_locations_code").on(table.code),
    index("idx_locations_is_sellable").on(table.isSellable),
  ]
);

export type LocationRow = typeof locations.$inferSelect;
export type InsertLocationRow = typeof locations.$inferInsert;

// 2. Inventory Balances Table
export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    skuId: uuid("sku_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    onHand: integer("on_hand").default(0).notNull(),
    reserved: integer("reserved").default(0).notNull(),
    safetyStock: integer("safety_stock").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.skuId, table.locationId] }),
    index("idx_inventory_balances_location").on(table.locationId),
    check(
      "inventory_balances_check",
      sql`${table.reserved} >= 0 AND ${table.onHand} >= ${table.reserved}`
    ),
  ]
);

export type InventoryBalanceRow = typeof inventoryBalances.$inferSelect;
export type InsertInventoryBalanceRow = typeof inventoryBalances.$inferInsert;

// 3. Stock Movements Table (Append-only)
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    skuId: uuid("sku_id").notNull(),
    fromLocationId: uuid("from_location_id").references(() => locations.id),
    toLocationId: uuid("to_location_id").references(() => locations.id),
    qty: integer("qty").notNull(),
    reason: text("reason", { enum: stockMovementReasonEnum }).notNull(),
    refType: text("ref_type").notNull(),
    refId: text("ref_id").notNull(),
    unitCostPaisa: bigint("unit_cost_paisa", { mode: "number" }).notNull(),
    staffId: uuid("staff_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_stock_movements_sku_id").on(table.skuId),
    index("idx_stock_movements_from_loc").on(table.fromLocationId),
    index("idx_stock_movements_to_loc").on(table.toLocationId),
    index("idx_stock_movements_created_at").on(table.createdAt),
    index("idx_stock_movements_ref").on(table.refType, table.refId),
  ]
);

export type StockMovementRow = typeof stockMovements.$inferSelect;
export type InsertStockMovementRow = typeof stockMovements.$inferInsert;

// 4. Stock Reservations Table
export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id"),
    cartHoldId: uuid("cart_hold_id"),
    orderItemId: uuid("order_item_id"),
    skuId: uuid("sku_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    qty: integer("qty").notNull(),
    status: text("status", { enum: stockReservationStatusEnum })
      .default("ACTIVE")
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_stock_reservations_status_expires").on(
      table.status,
      table.expiresAt
    ),
    index("idx_stock_reservations_order_id").on(table.orderId),
    index("idx_stock_reservations_cart_hold_id").on(table.cartHoldId),
    index("idx_stock_reservations_sku_location").on(
      table.skuId,
      table.locationId
    ),
    check(
      "stock_reservations_owner_check",
      sql`(${table.orderId} IS NOT NULL AND ${table.cartHoldId} IS NULL) OR (${table.orderId} IS NULL AND ${table.cartHoldId} IS NOT NULL)`
    ),
  ]
);

export type StockReservationRow = typeof stockReservations.$inferSelect;
export type InsertStockReservationRow = typeof stockReservations.$inferInsert;

// 5. Stock Adjustment Requests Table
export const stockAdjustmentRequests = pgTable(
  "stock_adjustment_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    skuId: uuid("sku_id").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    requestedBy: uuid("requested_by").notNull(),
    status: text("status", { enum: stockAdjustmentStatusEnum })
      .default("PENDING")
      .notNull(),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_stock_adj_sku_loc").on(table.skuId, table.locationId),
    index("idx_stock_adj_status").on(table.status),
  ]
);

export type StockAdjustmentRequestRow = typeof stockAdjustmentRequests.$inferSelect;
export type InsertStockAdjustmentRequestRow =
  typeof stockAdjustmentRequests.$inferInsert;

// 6. Cycle Counts Table
export const cycleCounts = pgTable(
  "cycle_counts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    status: text("status", { enum: cycleCountStatusEnum })
      .default("IN_PROGRESS")
      .notNull(),
    startedBy: uuid("started_by").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_cycle_counts_location").on(table.locationId),
    index("idx_cycle_counts_status").on(table.status),
  ]
);

export type CycleCountRow = typeof cycleCounts.$inferSelect;
export type InsertCycleCountRow = typeof cycleCounts.$inferInsert;

// 7. Cycle Count Lines Table
export const cycleCountLines = pgTable(
  "cycle_count_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countId: uuid("count_id")
      .notNull()
      .references(() => cycleCounts.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id").notNull(),
    systemQty: integer("system_qty").notNull(),
    countedQty: integer("counted_qty").notNull(),
    variance: integer("variance").notNull(), // countedQty - systemQty
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_cycle_count_lines_count_id").on(table.countId),
    index("idx_cycle_count_lines_sku_id").on(table.skuId),
  ]
);

export type CycleCountLineRow = typeof cycleCountLines.$inferSelect;
export type InsertCycleCountLineRow = typeof cycleCountLines.$inferInsert;
