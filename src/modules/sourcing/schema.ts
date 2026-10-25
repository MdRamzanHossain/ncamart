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
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enums
export const supplierMarketEnum = [
  "NAWABPUR_COMPLEX",
  "SUNDARBAN_SQUARE",
  "STADIUM_MARKET",
  "PATUATULI",
  "IMPORT",
] as const;
export type SupplierMarket = (typeof supplierMarketEnum)[number];

export const supplierPaymentModeEnum = [
  "CASH",
  "BKASH",
  "SUPPLIER_CREDIT",
] as const;
export type SupplierPaymentMode = (typeof supplierPaymentModeEnum)[number];

export const supplierStatusEnum = ["ACTIVE", "SUSPENDED"] as const;
export type SupplierStatus = (typeof supplierStatusEnum)[number];

export const supplierStockStatusEnum = ["AVAILABLE", "LIMITED", "OUT"] as const;
export type SupplierStockStatus = (typeof supplierStockStatusEnum)[number];

export const supplierQcOutcomeEnum = ["ACCEPTED", "RETURNED"] as const;
export type SupplierQcOutcome = (typeof supplierQcOutcomeEnum)[number];

// 1. Suppliers Table
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    proprietorName: text("proprietor_name").notNull(),
    market: text("market", { enum: supplierMarketEnum }).notNull(),
    stallNo: text("stall_no").notNull(),
    floor: text("floor").notNull(),
    phone: text("phone").notNull(),
    bkashMerchantNumber: text("bkash_merchant_number"),
    acceptedPaymentModes: text("accepted_payment_modes").array().notNull(),
    status: text("status", { enum: supplierStatusEnum }).default("ACTIVE").notNull(),
    suspendedReason: text("suspended_reason"),
    totalUnitsSourced: integer("total_units_sourced").default(0).notNull(),
    qcFailedUnits: integer("qc_failed_units").default(0).notNull(),
    defectRateBp: integer("defect_rate_bp").default(0).notNull(), // 100 bp = 1.00%
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_suppliers_status").on(table.status),
    index("idx_suppliers_market").on(table.market),
    index("idx_suppliers_phone").on(table.phone),
  ]
);

export type SupplierRow = typeof suppliers.$inferSelect;
export type InsertSupplierRow = typeof suppliers.$inferInsert;

// 2. Supplier Stock Table
export const supplierStock = pgTable(
  "supplier_stock",
  {
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id").notNull(),
    status: text("status", { enum: supplierStockStatusEnum })
      .default("AVAILABLE")
      .notNull(),
    dailyOrderCap: integer("daily_order_cap"),
    lastQuotedCostPaisa: bigint("last_quoted_cost_paisa", { mode: "number" }),
    priority: integer("priority").default(1).notNull(), // 1 = primary, 2 = backup, etc.
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).defaultNow().notNull(),
    confirmedBy: uuid("confirmed_by"),
  },
  (table) => [
    primaryKey({ columns: [table.supplierId, table.skuId] }),
    index("idx_supplier_stock_sku_id").on(table.skuId),
    index("idx_supplier_stock_status").on(table.status),
    index("idx_supplier_stock_priority").on(table.priority),
  ]
);

export type SupplierStockRow = typeof supplierStock.$inferSelect;
export type InsertSupplierStockRow = typeof supplierStock.$inferInsert;

// 3. Supplier QC Batches Table
export const supplierQcBatches = pgTable(
  "supplier_qc_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    runnerTaskId: uuid("runner_task_id"),
    unitsTotal: integer("units_total").notNull(),
    unitsFailed: integer("units_failed").notNull(),
    outcome: text("outcome", { enum: supplierQcOutcomeEnum }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_supplier_qc_batches_supplier_id").on(table.supplierId),
    index("idx_supplier_qc_batches_created_at").on(table.createdAt),
  ]
);

export type SupplierQcBatchRow = typeof supplierQcBatches.$inferSelect;
export type InsertSupplierQcBatchRow = typeof supplierQcBatches.$inferInsert;

// 4. Runner Task Enums
export const runnerTaskTypeEnum = [
  "SOURCING",
  "SUPPLIER_RETURN",
  "WARRANTY_LIAISON",
] as const;
export type RunnerTaskType = (typeof runnerTaskTypeEnum)[number];

export const runnerTaskStatusEnum = [
  "PENDING_ASSIGNMENT",
  "DISPATCHED",
  "STALL_CONTACTED",
  "PRICE_EXCEEDED_PENDING",
  "PURCHASED",
  "RECEIVED_AT_GODOWN",
  "REROUTED",
  "CANCELLED",
  "DECLINED",
] as const;
export type RunnerTaskStatus = (typeof runnerTaskStatusEnum)[number];

export const runnerOverrideDecisionEnum = [
  "APPROVED",
  "REROUTED",
  "DECLINED",
] as const;
export type RunnerOverrideDecision = (typeof runnerOverrideDecisionEnum)[number];

export const runnerTaskEventActorTypeEnum = [
  "STAFF",
  "RUNNER",
  "SYSTEM",
] as const;
export type RunnerTaskEventActorType = (typeof runnerTaskEventActorTypeEnum)[number];

export const runnerFloatSessionStatusEnum = [
  "OPEN",
  "PENDING_COUNT",
  "VARIANCE_REVIEW",
  "CLOSED",
] as const;
export type RunnerFloatSessionStatus = (typeof runnerFloatSessionStatusEnum)[number];

// 5. Runner Tasks Table
export const runnerTasks = pgTable(
  "runner_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskNumber: text("task_number").notNull().unique(),
    taskType: text("task_type", { enum: runnerTaskTypeEnum }).notNull(),
    orderId: uuid("order_id"),
    orderItemId: uuid("order_item_id"),
    skuId: uuid("sku_id").notNull(),
    qty: integer("qty").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    backupSupplierId: uuid("backup_supplier_id").references(() => suppliers.id),
    maxUnitPricePaisa: bigint("max_unit_price_paisa", { mode: "number" }).notNull(),
    runnerId: uuid("runner_id"),
    status: text("status", { enum: runnerTaskStatusEnum })
      .default("PENDING_ASSIGNMENT")
      .notNull(),
    quotedUnitPricePaisa: bigint("quoted_unit_price_paisa", { mode: "number" }),
    overrideReason: text("override_reason"),
    overrideDecidedBy: uuid("override_decided_by"),
    overrideDecision: text("override_decision", { enum: runnerOverrideDecisionEnum }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_runner_tasks_runner_id").on(table.runnerId),
    index("idx_runner_tasks_status").on(table.status),
    index("idx_runner_tasks_order_id").on(table.orderId),
    index("idx_runner_tasks_sku_id").on(table.skuId),
    index("idx_runner_tasks_due_at").on(table.dueAt),
    index("idx_runner_tasks_created_at").on(table.createdAt),
  ]
);

export type RunnerTaskRow = typeof runnerTasks.$inferSelect;
export type InsertRunnerTaskRow = typeof runnerTasks.$inferInsert;

// 6. Runner Task Events Table (Append-only)
export const runnerTaskEvents = pgTable(
  "runner_task_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => runnerTasks.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorType: text("actor_type", { enum: runnerTaskEventActorTypeEnum }).notNull(),
    actorId: text("actor_id"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_runner_task_events_task_id").on(table.taskId),
    index("idx_runner_task_events_created_at").on(table.createdAt),
  ]
);

export type RunnerTaskEventRow = typeof runnerTaskEvents.$inferSelect;
export type InsertRunnerTaskEventRow = typeof runnerTaskEvents.$inferInsert;

// 7. Runner Float Sessions Table (P24 Shift Status & P25 Float Sessions)
export const runnerFloatSessions = pgTable(
  "runner_float_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runnerId: uuid("runner_id").notNull(),
    issuedPaisa: bigint("issued_paisa", { mode: "number" }).default(0).notNull(),
    purchasesCashPaisa: bigint("purchases_cash_paisa", { mode: "number" }).default(0).notNull(),
    supplierRefundsPaisa: bigint("supplier_refunds_paisa", { mode: "number" }).default(0).notNull(),
    returnedPaisa: bigint("returned_paisa", { mode: "number" }),
    variancePaisa: bigint("variance_paisa", { mode: "number" }),
    status: text("status", { enum: runnerFloatSessionStatusEnum })
      .default("OPEN")
      .notNull(),
    openedBy: uuid("opened_by").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    countedBy: uuid("counted_by"),
    countedAt: timestamp("counted_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    varianceReason: text("variance_reason"),
    smSignoffBy: uuid("sm_signoff_by"),
    foSignoffBy: uuid("fo_signoff_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_runner_float_sessions_runner").on(table.runnerId),
    index("idx_runner_float_sessions_status").on(table.status),
    uniqueIndex("idx_runner_float_sessions_unique_open")
      .on(table.runnerId)
      .where(sql`status = 'OPEN'`),
  ]
);

export type RunnerFloatSessionRow = typeof runnerFloatSessions.$inferSelect;
export type InsertRunnerFloatSessionRow = typeof runnerFloatSessions.$inferInsert;

// 8. Runner Purchases Table (P25 Runner Purchases & Offline Sync)
export const runnerPurchaseSyncStatusEnum = [
  "OK",
  "CONFLICT",
  "QUARANTINED",
  "REJECTED",
] as const;
export type RunnerPurchaseSyncStatus = (typeof runnerPurchaseSyncStatusEnum)[number];

export const runnerPurchases = pgTable(
  "runner_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientMutationId: text("client_mutation_id").unique().notNull(),
    taskId: uuid("task_id").references(() => runnerTasks.id),
    floatSessionId: uuid("float_session_id").references(() => runnerFloatSessions.id),
    runnerId: uuid("runner_id").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    skuId: uuid("sku_id").notNull(),
    qty: integer("qty").notNull(),
    unitCostPaisa: bigint("unit_cost_paisa", { mode: "number" }).notNull(),
    amountPaisa: bigint("amount_paisa", { mode: "number" }).notNull(),
    paymentMode: text("payment_mode", { enum: ["CASH", "SUPPLIER_CREDIT"] }).notNull(),
    receiptMediaId: uuid("receipt_media_id"),
    receiptMissingFlag: boolean("receipt_missing_flag").default(false).notNull(),
    requiresApproval: boolean("requires_approval").default(false).notNull(),
    approvedBy: uuid("approved_by"),
    syncStatus: text("sync_status", { enum: runnerPurchaseSyncStatusEnum }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_runner_purchases_client_mutation_id").on(table.clientMutationId),
    index("idx_runner_purchases_runner_id").on(table.runnerId),
    index("idx_runner_purchases_task_id").on(table.taskId),
    index("idx_runner_purchases_float_session_id").on(table.floatSessionId),
    index("idx_runner_purchases_sync_status").on(table.syncStatus),
  ]
);

export type RunnerPurchaseRow = typeof runnerPurchases.$inferSelect;
export type InsertRunnerPurchaseRow = typeof runnerPurchases.$inferInsert;

