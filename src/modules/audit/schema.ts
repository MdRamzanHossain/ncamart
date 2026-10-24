import { pgTable, bigserial, uuid, text, jsonb, timestamp, char, index } from "drizzle-orm/pg-core";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    staffId: uuid("staff_id"),
    actorType: text("actor_type", { enum: ["STAFF", "SYSTEM", "CUSTOMER"] }).notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    prevHash: char("prev_hash", { length: 64 }).notNull(),
    hash: char("hash", { length: 64 }).notNull(),
  },
  (table) => [
    index("idx_audit_logs_entity").on(table.entityType, table.entityId),
    index("idx_audit_logs_staff_id").on(table.staffId),
    index("idx_audit_logs_created_at").on(table.createdAt),
  ]
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
export type InsertAuditLogRow = typeof auditLogs.$inferInsert;
