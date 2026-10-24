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
} from "drizzle-orm/pg-core";
import { orders } from "@/modules/orders/schema";

// --------------------------------------------------------------------------
// Enums
// --------------------------------------------------------------------------
export const courierEnum = [
  "STEADFAST",
  "PATHAO",
  "REDX",
  "MOCK",
  "MANUAL",
] as const;
export type CourierCode = (typeof courierEnum)[number];

export const shipmentDirectionEnum = ["FORWARD", "REVERSE"] as const;
export type ShipmentDirection = (typeof shipmentDirectionEnum)[number];

export const shipmentStatusEnum = [
  "PENDING_BOOKING",
  "BOOKED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "PARTIALLY_DELIVERED",
  "RTO_IN_TRANSIT",
  "RETURNED",
  "LOST",
  "BOOKING_FAILED",
  "CANCELLED",
] as const;
export type ShipmentStatus = (typeof shipmentStatusEnum)[number];

// --------------------------------------------------------------------------
// 1. Courier Shipments Table
// --------------------------------------------------------------------------
export const courierShipments = pgTable(
  "courier_shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    courier: text("courier", { enum: courierEnum }).notNull(),
    direction: text("direction", { enum: shipmentDirectionEnum })
      .default("FORWARD")
      .notNull(),
    consignmentNo: text("consignment_no").unique(),
    trackingUrl: text("tracking_url"),
    status: text("status", { enum: shipmentStatusEnum })
      .default("PENDING_BOOKING")
      .notNull(),
    weightGrams: integer("weight_grams").notNull(),
    expectedCodPaisa: bigint("expected_cod_paisa", { mode: "number" }).notNull(),
    collectedCodPaisa: bigint("collected_cod_paisa", { mode: "number" }),
    deliveryChargePaisa: bigint("delivery_charge_paisa", { mode: "number" }),
    codChargePaisa: bigint("cod_charge_paisa", { mode: "number" }),
    returnChargePaisa: bigint("return_charge_paisa", { mode: "number" }),
    bookingAttempts: integer("booking_attempts").default(0).notNull(),
    lastError: text("last_error"),
    bookedAt: timestamp("booked_at", { withTimezone: true }),
    handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_courier_shipments_order_id").on(table.orderId),
    index("idx_courier_shipments_status").on(table.status),
    index("idx_courier_shipments_courier").on(table.courier),
    uniqueIndex("uq_courier_shipments_consignment_no").on(table.consignmentNo),
  ]
);

export type CourierShipmentRow = typeof courierShipments.$inferSelect;
export type InsertCourierShipmentRow = typeof courierShipments.$inferInsert;

// --------------------------------------------------------------------------
// 2. Courier Events Table (Append-Only Event Ledger)
// --------------------------------------------------------------------------
export const courierEvents = pgTable(
  "courier_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => courierShipments.id, { onDelete: "cascade" }),
    rawStatus: text("raw_status").notNull(),
    normalizedStatus: text("normalized_status").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dedupeKey: text("dedupe_key").unique().notNull(),
  },
  (table) => [
    index("idx_courier_events_shipment_id").on(table.shipmentId),
    uniqueIndex("uq_courier_events_dedupe_key").on(table.dedupeKey),
  ]
);

export type CourierEventRow = typeof courierEvents.$inferSelect;
export type InsertCourierEventRow = typeof courierEvents.$inferInsert;

// --------------------------------------------------------------------------
// 3. Courier Location Map Table
// --------------------------------------------------------------------------
export const courierLocationMap = pgTable(
  "courier_location_map",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courier: text("courier", { enum: courierEnum }).notNull(),
    district: text("district").notNull(),
    thana: text("thana").notNull(),
    hubId: text("hub_id"),
    cityId: text("city_id"),
    zoneId: text("zone_id"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_courier_location_map_lookup").on(
      table.courier,
      table.district,
      table.thana
    ),
  ]
);

export type CourierLocationMapRow = typeof courierLocationMap.$inferSelect;
export type InsertCourierLocationMapRow = typeof courierLocationMap.$inferInsert;
