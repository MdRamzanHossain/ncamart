import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "@/modules/identity/schema";
import { orders, orderItemUnits } from "@/modules/orders/schema";
import { courierShipments } from "@/modules/logistics/schema";
import { runnerTasks } from "@/modules/sourcing/schema";

// --------------------------------------------------------------------------
// Enums
// --------------------------------------------------------------------------
export const claimTypeEnum = [
  "DOA",
  "BUDGET_7_DAY",
  "AUTHENTIC_WARRANTY",
  "TRANSIT_DAMAGE",
] as const;
export type ClaimType = (typeof claimTypeEnum)[number];

export const claimStatusEnum = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "REVERSE_PICKUP",
  "RECEIVED",
  "INSPECTING",
  "DISTRIBUTOR_LIAISON",
  "RESOLVED",
  "CLOSED",
] as const;
export type ClaimStatus = (typeof claimStatusEnum)[number];

export const claimPriorityEnum = [
  "DOA_FAST_TRACK",
  "NORMAL",
] as const;
export type ClaimPriority = (typeof claimPriorityEnum)[number];

export const claimRejectionReasonEnum = [
  "SEAL_TAMPERED",
  "PHYSICAL_DAMAGE",
  "LIQUID",
  "SEVERED_CABLE",
  "OUT_OF_WARRANTY",
  "NO_DEFECT_FOUND",
  "OTHER",
] as const;
export type ClaimRejectionReason = (typeof claimRejectionReasonEnum)[number];

export const claimResolutionEnum = [
  "REPLACE",
  "REPAIR",
  "REFUND",
  "STORE_CREDIT",
] as const;
export type ClaimResolution = (typeof claimResolutionEnum)[number];

export const distributorOutcomeEnum = [
  "REPAIRED",
  "REPLACED",
  "REFUSED",
] as const;
export type DistributorOutcome = (typeof distributorOutcomeEnum)[number];

export const claimEventActorTypeEnum = [
  "CUSTOMER",
  "STAFF",
  "SYSTEM",
] as const;
export type ClaimEventActorType = (typeof claimEventActorTypeEnum)[number];

// --------------------------------------------------------------------------
// 1. Warranty Claims Table
// --------------------------------------------------------------------------
export const warrantyClaims = pgTable(
  "warranty_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    claimNumber: text("claim_number").notNull().unique(), // RMA-YYYY-NNNN
    sealId: text("seal_id").notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemUnitId: uuid("order_item_unit_id").references(
      () => orderItemUnits.id,
      { onDelete: "set null" }
    ),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    claimType: text("claim_type", { enum: claimTypeEnum }).notNull(),
    issueDescription: text("issue_description").notNull(),
    status: text("status", { enum: claimStatusEnum })
      .default("SUBMITTED")
      .notNull(),
    priority: text("priority", { enum: claimPriorityEnum })
      .default("NORMAL")
      .notNull(),
    decision: text("decision"),
    rejectionReason: text("rejection_reason", { enum: claimRejectionReasonEnum }),
    resolution: text("resolution", { enum: claimResolutionEnum }),
    reverseShipmentId: uuid("reverse_shipment_id").references(
      () => courierShipments.id,
      { onDelete: "set null" }
    ),
    replacementOrderId: uuid("replacement_order_id").references(
      () => orders.id,
      { onDelete: "set null" }
    ),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
    adjudicatedBy: uuid("adjudicated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    adjudicatedAt: timestamp("adjudicated_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    isNonOriginalOwner: boolean("is_non_original_owner").default(false).notNull(),
    wantsAssistedTransit: boolean("wants_assisted_transit").default(false).notNull(),
    distributorName: text("distributor_name"),
    distributorSentAt: timestamp("distributor_sent_at", { withTimezone: true }),
    distributorReturnedAt: timestamp("distributor_returned_at", { withTimezone: true }),
    distributorOutcome: text("distributor_outcome", { enum: distributorOutcomeEnum }),
    liaisonTaskId: uuid("liaison_task_id").references(() => runnerTasks.id, {
      onDelete: "set null",
    }),
    inspectionNotes: text("inspection_notes"),
    verifiedDefect: boolean("verified_defect"),
    sealIntact: boolean("seal_intact"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_warranty_claims_claim_number").on(table.claimNumber),
    index("idx_warranty_claims_seal_id").on(table.sealId),
    index("idx_warranty_claims_order_id").on(table.orderId),
    index("idx_warranty_claims_customer_id").on(table.customerId),
    index("idx_warranty_claims_status").on(table.status),
    index("idx_warranty_claims_priority").on(table.priority),
    index("idx_warranty_claims_created_at").on(table.createdAt),
  ]
);

export type WarrantyClaimRow = typeof warrantyClaims.$inferSelect;
export type InsertWarrantyClaimRow = typeof warrantyClaims.$inferInsert;

// --------------------------------------------------------------------------
// 2. Claim Events Table (Append-only)
// --------------------------------------------------------------------------
export const claimEvents = pgTable(
  "claim_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => warrantyClaims.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorType: text("actor_type", { enum: claimEventActorTypeEnum }).notNull(),
    actorId: uuid("actor_id"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_claim_events_claim_id").on(table.claimId),
    index("idx_claim_events_created_at").on(table.createdAt),
  ]
);

export type ClaimEventRow = typeof claimEvents.$inferSelect;
export type InsertClaimEventRow = typeof claimEvents.$inferInsert;
