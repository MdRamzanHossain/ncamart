import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  char,
  bigint,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").notNull(),
    notificationClass: char("notification_class", { length: 1 }),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
  },
  (table) => [
    index("idx_outbox_unpublished")
      .on(table.availableAt)
      .where(sql`published_at IS NULL`),
    index("idx_outbox_aggregate").on(table.aggregateType, table.aggregateId),
  ]
);

export type OutboxRow = typeof outbox.$inferSelect;
export type InsertOutboxRow = typeof outbox.$inferInsert;

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: text("key").notNull(),
    scope: text("scope").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.scope] }),
    index("idx_idempotency_expires_at").on(table.expiresAt),
  ]
);

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
export type InsertIdempotencyKeyRow = typeof idempotencyKeys.$inferInsert;

export const numberCounters = pgTable(
  "number_counters",
  {
    scope: text("scope").notNull(),
    period: text("period").notNull(),
    lastNo: bigint("last_no", { mode: "bigint" }).default(sql`0`).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.period] }),
  ]
);

export type NumberCounterRow = typeof numberCounters.$inferSelect;
export type InsertNumberCounterRow = typeof numberCounters.$inferInsert;
