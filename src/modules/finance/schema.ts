import {
  pgTable,
  text,
  timestamp,
  uuid,
  bigint,
  jsonb,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { orders } from "@/modules/orders/schema";

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
