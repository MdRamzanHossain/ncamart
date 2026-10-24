import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { staff } from "@/modules/identity/schema";

export const drawerStatusEnum = [
  "OPEN",
  "COUNTED",
  "VARIANCE_REVIEW",
  "CLOSED",
] as const;
export type DrawerStatus = (typeof drawerStatusEnum)[number];

export const cashDrawerSessions = pgTable(
  "cash_drawer_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    openingFloatPaisa: integer("opening_float_paisa").default(0).notNull(),
    cashSalesPaisa: integer("cash_sales_paisa").default(0).notNull(),
    cashRefundsPaisa: integer("cash_refunds_paisa").default(0).notNull(),
    expectedCashPaisa: integer("expected_cash_paisa").default(0).notNull(),
    countedCashPaisa: integer("counted_cash_paisa"),
    variancePaisa: integer("variance_paisa"),
    status: text("status", { enum: drawerStatusEnum })
      .default("OPEN")
      .notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    countedAt: timestamp("counted_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    reconciledBy: uuid("reconciled_by").references(() => staff.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_cash_drawer_one_open_per_staff")
      .on(table.staffId)
      .where(sql`status = 'OPEN'`),
    index("idx_cash_drawer_staff_id").on(table.staffId),
    index("idx_cash_drawer_status").on(table.status),
    index("idx_cash_drawer_opened_at").on(table.openedAt),
  ]
);

export type CashDrawerSessionRow = typeof cashDrawerSessions.$inferSelect;
export type InsertCashDrawerSessionRow = typeof cashDrawerSessions.$inferInsert;
