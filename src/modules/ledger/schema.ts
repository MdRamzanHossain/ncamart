// Schema definition for module: ledger
// NOTE: Internal to this module. Other modules MUST NOT import directly.

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  bigint,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const accountTypeEnum = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
export type AccountType = (typeof accountTypeEnum)[number];

export const normalSideEnum = ["DEBIT", "CREDIT"] as const;
export type NormalSide = (typeof normalSideEnum)[number];

export const subLedgerTypeEnum = [
  "ORDER",
  "CUSTOMER",
  "COURIER",
  "SUPPLIER",
  "RUNNER",
  "DRAWER",
] as const;
export type SubLedgerType = (typeof subLedgerTypeEnum)[number];

export const postedByTypeEnum = ["STAFF", "SYSTEM"] as const;
export type PostedByType = (typeof postedByTypeEnum)[number];

// 1. Ledger Accounts (Chart of Accounts)
export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 10 }).notNull().unique(),
    name: text("name").notNull(),
    type: text("type", { enum: accountTypeEnum }).notNull(),
    normalSide: text("normal_side", { enum: normalSideEnum }).notNull(),
    isContra: boolean("is_contra").notNull().default(false),
    requiresSubLedger: boolean("requires_sub_ledger").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_ledger_accounts_code").on(table.code),
    index("idx_ledger_accounts_type").on(table.type),
  ]
);

export type LedgerAccountRow = typeof ledgerAccounts.$inferSelect;
export type InsertLedgerAccountRow = typeof ledgerAccounts.$inferInsert;

// 2. Journal Entries (Header)
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryNumber: varchar("entry_number", { length: 30 }).notNull().unique(),
    eventType: text("event_type").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    description: text("description").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).defaultNow().notNull(),
    postedByType: text("posted_by_type", { enum: postedByTypeEnum }).notNull(),
    postedById: uuid("posted_by_id"),
    reversalOf: uuid("reversal_of"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_journal_entries_idempotency").on(
      table.eventType,
      table.sourceType,
      table.sourceId
    ),
    index("idx_journal_entries_posted_at").on(table.postedAt),
    index("idx_journal_entries_source").on(table.sourceType, table.sourceId),
    index("idx_journal_entries_event").on(table.eventType),
  ]
);

export type JournalEntryRow = typeof journalEntries.$inferSelect;
export type InsertJournalEntryRow = typeof journalEntries.$inferInsert;

// 3. Journal Lines (Debits and Credits)
export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    subLedgerType: text("sub_ledger_type", { enum: subLedgerTypeEnum }),
    subLedgerRef: text("sub_ledger_ref"),
    debitPaisa: bigint("debit_paisa", { mode: "number" }).notNull().default(0),
    creditPaisa: bigint("credit_paisa", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_journal_lines_entry").on(table.entryId),
    index("idx_journal_lines_account").on(table.accountId),
    index("idx_journal_lines_subledger").on(
      table.accountId,
      table.subLedgerType,
      table.subLedgerRef
    ),
  ]
);

export type JournalLineRow = typeof journalLines.$inferSelect;
export type InsertJournalLineRow = typeof journalLines.$inferInsert;
