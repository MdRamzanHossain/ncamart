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
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skus } from "@/modules/catalog/schema";
import { orderItemUnits } from "@/modules/orders/schema";

// --------------------------------------------------------------------------
// Enums
// --------------------------------------------------------------------------
export const sealStatusEnum = [
  "GENERATED",
  "PRINTED",
  "ACTIVE",
  "CLAIMED",
  "EXPIRED",
  "VOID_PRINT_ERROR",
] as const;
export type SealStatus = (typeof sealStatusEnum)[number];

export const qcTypeEnum = [
  "THREE_POINT",
  "NON_INVASIVE",
  "FULL_PRE_DISPATCH",
] as const;
export type QcType = (typeof qcTypeEnum)[number];

export const qcResultEnum = ["PASS", "FAIL"] as const;
export type QcResult = (typeof qcResultEnum)[number];

export const sealVoidReasonEnum = [
  "PRINTER_JAM",
  "RIBBON_TEAR",
  "STICKER_DAMAGED",
] as const;
export type SealVoidReason = (typeof sealVoidReasonEnum)[number];

export const sealVoidRequestStatusEnum = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type SealVoidRequestStatus = (typeof sealVoidRequestStatusEnum)[number];

// --------------------------------------------------------------------------
// 1. Seal Records Table
// --------------------------------------------------------------------------
export const sealRecords = pgTable(
  "seal_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sealId: text("seal_id").notNull(),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => skus.id),
    productTier: text("product_tier", { enum: ["AUTHENTIC", "BUDGET_SMART"] }).notNull(),
    orderItemUnitId: uuid("order_item_unit_id").references(() => orderItemUnits.id),
    manufacturerSerial: text("manufacturer_serial"),
    status: text("status", { enum: sealStatusEnum })
      .default("GENERATED")
      .notNull(),
    technicianId: uuid("technician_id").notNull(),
    warrantyDays: integer("warranty_days").default(0).notNull(),
    warrantyStart: timestamp("warranty_start", { withTimezone: true }),
    warrantyEnd: timestamp("warranty_end", { withTimezone: true }),
    voidReason: text("void_reason", { enum: sealVoidReasonEnum }),
    replacedBySealId: text("replaced_by_seal_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_seal_records_seal_id").on(table.sealId),
    uniqueIndex("idx_seal_records_sku_serial")
      .on(table.skuId, table.manufacturerSerial)
      .where(sql`manufacturer_serial IS NOT NULL`),
    index("idx_seal_records_manufacturer_serial").on(table.manufacturerSerial),
    index("idx_seal_records_sku_id").on(table.skuId),
    index("idx_seal_records_status").on(table.status),
    index("idx_seal_records_unit_id").on(table.orderItemUnitId),
    check(
      "seal_id_crockford_check",
      sql`${table.sealId} ~ '^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'`
    ),
  ]
);

export type SealRecordRow = typeof sealRecords.$inferSelect;
export type InsertSealRecordRow = typeof sealRecords.$inferInsert;

// --------------------------------------------------------------------------
// 2. Seal Events Table (Append-only)
// --------------------------------------------------------------------------
export const sealEvents = pgTable(
  "seal_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sealId: text("seal_id").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorId: text("actor_id"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_seal_events_seal_id").on(table.sealId),
    index("idx_seal_events_created_at").on(table.createdAt),
  ]
);

export type SealEventRow = typeof sealEvents.$inferSelect;
export type InsertSealEventRow = typeof sealEvents.$inferInsert;

// --------------------------------------------------------------------------
// 3. QC Records Table
// --------------------------------------------------------------------------
export const qcRecords = pgTable(
  "qc_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sealId: text("seal_id"),
    orderItemUnitId: uuid("order_item_unit_id"),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => skus.id),
    qcType: text("qc_type", { enum: qcTypeEnum }).notNull(),
    testChecklist: jsonb("test_checklist").$type<Record<string, unknown>>().notNull(),
    result: text("result", { enum: qcResultEnum }).notNull(),
    technicianId: uuid("technician_id").notNull(),
    photos: jsonb("photos").$type<string[]>().default([]).notNull(),
    sampledForAudit: boolean("sampled_for_audit").default(false).notNull(),
    supervisorId: uuid("supervisor_id"),
    supervisorResult: text("supervisor_result", { enum: qcResultEnum }),
    supervisorCheckedAt: timestamp("supervisor_checked_at", { withTimezone: true }),
    auditDueAt: timestamp("audit_due_at", { withTimezone: true }),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    testerNotes: text("tester_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_qc_records_sku_id").on(table.skuId),
    index("idx_qc_records_unit_id").on(table.orderItemUnitId),
    index("idx_qc_records_seal_id").on(table.sealId),
    index("idx_qc_records_result").on(table.result),
    index("idx_qc_records_sampled").on(table.sampledForAudit),
    index("idx_qc_records_audit_due").on(table.auditDueAt),
  ]
);

export type QcRecordRow = typeof qcRecords.$inferSelect;
export type InsertQcRecordRow = typeof qcRecords.$inferInsert;

// --------------------------------------------------------------------------
// 4. Seal Void Requests Table
// --------------------------------------------------------------------------
export const sealVoidRequests = pgTable(
  "seal_void_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sealId: text("seal_id").notNull(),
    reason: text("reason", { enum: sealVoidReasonEnum }).notNull(),
    requestedBy: uuid("requested_by").notNull(),
    status: text("status", { enum: sealVoidRequestStatusEnum })
      .default("PENDING")
      .notNull(),
    approvedBy: uuid("approved_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_seal_void_requests_seal_id").on(table.sealId),
    index("idx_seal_void_requests_status").on(table.status),
  ]
);

export type SealVoidRequestRow = typeof sealVoidRequests.$inferSelect;
export type InsertSealVoidRequestRow = typeof sealVoidRequests.$inferInsert;
