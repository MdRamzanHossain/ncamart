import {
  pgTable,
  text,
  timestamp,
  uuid,
  bigint,
  jsonb,
  varchar,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { orders } from "@/modules/orders/schema";
import { courierEnum, courierShipments } from "@/modules/logistics/schema";

// --------------------------------------------------------------------------
// Invoices
// --------------------------------------------------------------------------
export const invoiceTypeEnum = ["SYSTEM", "MUSHAK_6_3"] as const;
export type InvoiceType = (typeof invoiceTypeEnum)[number];

export interface InvoiceLineSnapshot {
  skuId: string;
  skuCode: string;
  titleEn: string;
  titleBn?: string;
  qty: number;
  unitPricePaisa: number;
  vatRateBp: number;
  vatPaisa: number;
  lineTotalPaisa: number;
}

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    invoiceNo: varchar("invoice_no", { length: 30 }).notNull().unique(),
    type: text("type", { enum: invoiceTypeEnum }).notNull(),
    mushakSerial: varchar("mushak_serial", { length: 60 }),
    fiscalYear: varchar("fiscal_year", { length: 15 }).notNull(),
    buyerName: text("buyer_name").notNull(),
    buyerBin: text("buyer_bin"),
    sellerBin: text("seller_bin").notNull(),
    lines: jsonb("lines").$type<InvoiceLineSnapshot[]>().notNull(),
    subtotalPaisa: bigint("subtotal_paisa", { mode: "number" }).notNull(),
    vatPaisa: bigint("vat_paisa", { mode: "number" }).notNull(),
    totalPaisa: bigint("total_paisa", { mode: "number" }).notNull(),
    pdfMediaId: uuid("pdf_media_id"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_invoices_order_id").on(table.orderId),
    uniqueIndex("idx_invoices_order_type").on(table.orderId, table.type),
    index("idx_invoices_mushak_serial").on(table.mushakSerial),
    index("idx_invoices_fiscal_year").on(table.fiscalYear),
  ]
);

export type InvoiceRow = typeof invoices.$inferSelect;
export type InsertInvoiceRow = typeof invoices.$inferInsert;

// --------------------------------------------------------------------------
// Enums for Settlements & Exceptions (P34)
// --------------------------------------------------------------------------
export const courierSettlementSourceEnum = ["API", "CSV"] as const;
export type CourierSettlementSource = (typeof courierSettlementSourceEnum)[number];

export const courierSettlementStatusEnum = [
  "IMPORTED",
  "MATCHING",
  "MATCHED",
  "HAS_EXCEPTIONS",
  "CLOSED",
] as const;
export type CourierSettlementStatus = (typeof courierSettlementStatusEnum)[number];

export const courierMatchStatusEnum = [
  "PENDING",
  "MATCHED",
  "SHORT_PAID",
  "OVER_PAID",
  "UNKNOWN_CONSIGNMENT",
  "RESOLVED",
] as const;
export type CourierMatchStatus = (typeof courierMatchStatusEnum)[number];

export const settlementExceptionKindEnum = [
  "SHORT_PAID",
  "OVER_PAID",
  "MISSING",
  "UNKNOWN_CONSIGNMENT",
  "GATEWAY_UNMATCHED",
] as const;
export type SettlementExceptionKind = (typeof settlementExceptionKindEnum)[number];

export const settlementExceptionStatusEnum = [
  "OPEN",
  "FOLLOWING_UP",
  "RESOLVED",
  "WRITTEN_OFF",
] as const;
export type SettlementExceptionStatus = (typeof settlementExceptionStatusEnum)[number];

export const settlementExceptionResolutionEnum = [
  "RECEIVED_LATER",
  "ADJUSTED",
  "WRITE_OFF",
] as const;
export type SettlementExceptionResolution = (typeof settlementExceptionResolutionEnum)[number];

export const gatewaySettlementStatusEnum = [
  "IMPORTED",
  "MATCHING",
  "MATCHED",
  "HAS_EXCEPTIONS",
  "CLOSED",
] as const;
export type GatewaySettlementStatus = (typeof gatewaySettlementStatusEnum)[number];

export const gatewayMatchStatusEnum = [
  "PENDING",
  "MATCHED",
  "GATEWAY_UNMATCHED",
  "RESOLVED",
] as const;
export type GatewayMatchStatus = (typeof gatewayMatchStatusEnum)[number];

// --------------------------------------------------------------------------
// 1. Courier Settlements Table
// --------------------------------------------------------------------------
export const courierSettlements = pgTable(
  "courier_settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courier: text("courier", { enum: courierEnum }).notNull(),
    payoutRef: varchar("payout_ref", { length: 100 }).notNull(),
    payoutDate: timestamp("payout_date", { withTimezone: true }).notNull(),
    grossCollectedPaisa: bigint("gross_collected_paisa", { mode: "number" }).notNull(),
    totalChargesPaisa: bigint("total_charges_paisa", { mode: "number" }).notNull(),
    netPaisa: bigint("net_paisa", { mode: "number" }).notNull(),
    source: text("source", { enum: courierSettlementSourceEnum }).notNull(),
    fileMediaId: uuid("file_media_id"),
    importedBy: text("imported_by").notNull(),
    status: text("status", { enum: courierSettlementStatusEnum })
      .default("IMPORTED")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_courier_settlements_courier_payout_ref").on(table.courier, table.payoutRef),
    index("idx_courier_settlements_courier").on(table.courier),
    index("idx_courier_settlements_status").on(table.status),
    index("idx_courier_settlements_payout_date").on(table.payoutDate),
  ]
);

export type CourierSettlementRow = typeof courierSettlements.$inferSelect;
export type InsertCourierSettlementRow = typeof courierSettlements.$inferInsert;

// --------------------------------------------------------------------------
// 2. Courier Settlement Lines Table
// --------------------------------------------------------------------------
export const courierSettlementLines = pgTable(
  "courier_settlement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => courierSettlements.id, { onDelete: "cascade" }),
    consignmentNo: text("consignment_no").notNull(),
    shipmentId: uuid("shipment_id").references(() => courierShipments.id),
    collectedPaisa: bigint("collected_paisa", { mode: "number" }).notNull(),
    deliveryChargePaisa: bigint("delivery_charge_paisa", { mode: "number" }).default(0).notNull(),
    codChargePaisa: bigint("cod_charge_paisa", { mode: "number" }).default(0).notNull(),
    returnChargePaisa: bigint("return_charge_paisa", { mode: "number" }).default(0).notNull(),
    matchStatus: text("match_status", { enum: courierMatchStatusEnum })
      .default("PENDING")
      .notNull(),
    variancePaisa: bigint("variance_paisa", { mode: "number" }).default(0).notNull(),
    resolutionNotes: text("resolution_notes"),
    resolvedBy: text("resolved_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_courier_settlement_lines_settlement_id").on(table.settlementId),
    index("idx_courier_settlement_lines_consignment_no").on(table.consignmentNo),
    index("idx_courier_settlement_lines_shipment_id").on(table.shipmentId),
    index("idx_courier_settlement_lines_match_status").on(table.matchStatus),
  ]
);

export type CourierSettlementLineRow = typeof courierSettlementLines.$inferSelect;
export type InsertCourierSettlementLineRow = typeof courierSettlementLines.$inferInsert;

// --------------------------------------------------------------------------
// 3. Settlement Exceptions Table
// --------------------------------------------------------------------------
export interface SettlementExceptionRefIds {
  settlementId?: string;
  settlementLineId?: string;
  shipmentId?: string;
  consignmentNo?: string;
  tranId?: string;
  [key: string]: unknown;
}

export const settlementExceptions = pgTable(
  "settlement_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind", { enum: settlementExceptionKindEnum }).notNull(),
    refIds: jsonb("ref_ids").$type<SettlementExceptionRefIds>().notNull(),
    amountPaisa: bigint("amount_paisa", { mode: "number" }).notNull(),
    status: text("status", { enum: settlementExceptionStatusEnum })
      .default("OPEN")
      .notNull(),
    ageDays: integer("age_days").default(0).notNull(),
    notes: text("notes"),
    resolution: text("resolution", { enum: settlementExceptionResolutionEnum }),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_settlement_exceptions_kind").on(table.kind),
    index("idx_settlement_exceptions_status").on(table.status),
    index("idx_settlement_exceptions_age_days").on(table.ageDays),
    index("idx_settlement_exceptions_created_at").on(table.createdAt),
  ]
);

export type SettlementExceptionRow = typeof settlementExceptions.$inferSelect;
export type InsertSettlementExceptionRow = typeof settlementExceptions.$inferInsert;

// --------------------------------------------------------------------------
// 4. Gateway Settlements Table
// --------------------------------------------------------------------------
export const gatewaySettlements = pgTable(
  "gateway_settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payoutRef: varchar("payout_ref", { length: 100 }).notNull().unique(),
    payoutDate: timestamp("payout_date", { withTimezone: true }).notNull(),
    grossAmountPaisa: bigint("gross_amount_paisa", { mode: "number" }).notNull(),
    totalFeePaisa: bigint("total_fee_paisa", { mode: "number" }).notNull(),
    netPaisa: bigint("net_paisa", { mode: "number" }).notNull(),
    source: text("source", { enum: courierSettlementSourceEnum }).default("CSV").notNull(),
    fileMediaId: uuid("file_media_id"),
    importedBy: text("imported_by").notNull(),
    status: text("status", { enum: gatewaySettlementStatusEnum })
      .default("IMPORTED")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_gateway_settlements_payout_ref").on(table.payoutRef),
    index("idx_gateway_settlements_status").on(table.status),
    index("idx_gateway_settlements_payout_date").on(table.payoutDate),
  ]
);

export type GatewaySettlementRow = typeof gatewaySettlements.$inferSelect;
export type InsertGatewaySettlementRow = typeof gatewaySettlements.$inferInsert;

// --------------------------------------------------------------------------
// 5. Gateway Settlement Lines Table
// --------------------------------------------------------------------------
export const gatewaySettlementLines = pgTable(
  "gateway_settlement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => gatewaySettlements.id, { onDelete: "cascade" }),
    tranId: text("tran_id").notNull(),
    amountPaisa: bigint("amount_paisa", { mode: "number" }).notNull(),
    feePaisa: bigint("fee_paisa", { mode: "number" }).default(0).notNull(),
    netPaisa: bigint("net_paisa", { mode: "number" }).notNull(),
    matchStatus: text("match_status", { enum: gatewayMatchStatusEnum })
      .default("PENDING")
      .notNull(),
    resolutionNotes: text("resolution_notes"),
    resolvedBy: text("resolved_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_gateway_settlement_lines_settlement_id").on(table.settlementId),
    index("idx_gateway_settlement_lines_tran_id").on(table.tranId),
    index("idx_gateway_settlement_lines_match_status").on(table.matchStatus),
  ]
);

export type GatewaySettlementLineRow = typeof gatewaySettlementLines.$inferSelect;
export type InsertGatewaySettlementLineRow = typeof gatewaySettlementLines.$inferInsert;
