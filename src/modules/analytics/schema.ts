import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const consentStatusEnum = ["GRANTED", "DENIED", "STRICTLY_NECESSARY"] as const;
export type ConsentStatus = (typeof consentStatusEnum)[number];

// 1. Analytics Events Table (Internal copy for KPIs, 13-month retention)
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventName: text("event_name").notNull(),
    aggregateType: text("aggregate_type"),
    aggregateId: text("aggregate_id"),
    userId: text("user_id"),
    anonymousId: text("anonymous_id"),
    properties: jsonb("properties").$type<Record<string, unknown>>().default({}).notNull(),
    consentStatus: text("consent_status", { enum: consentStatusEnum })
      .default("STRICTLY_NECESSARY")
      .notNull(),
    forwardedTo: jsonb("forwarded_to").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_analytics_events_name_created").on(table.eventName, table.createdAt),
    index("idx_analytics_events_user_id").on(table.userId),
    index("idx_analytics_events_aggregate").on(table.aggregateType, table.aggregateId),
    index("idx_analytics_events_created_at").on(table.createdAt),
  ]
);

export type AnalyticsEventRow = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEventRow = typeof analyticsEvents.$inferInsert;
