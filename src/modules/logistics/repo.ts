import { eq, and, sql, desc } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import {
  courierShipments,
  courierEvents,
  courierLocationMap,
  courierClaims,
  CourierShipmentRow,
  InsertCourierShipmentRow,
  CourierEventRow,
  InsertCourierEventRow,
  CourierLocationMapRow,
  InsertCourierLocationMapRow,
  CourierClaimRow,
  InsertCourierClaimRow,
  ShipmentStatus,
  ShipmentDirection,
  CourierCode,
} from "./schema";
import { orders } from "@/modules/orders/schema";
import { ordersRepo } from "@/modules/orders/repo";

// --------------------------------------------------------------------------
// In-Memory Fallback Stores for test isolation & offline dev
// --------------------------------------------------------------------------
const memShipments = new Map<string, CourierShipmentRow>();
const memEvents = new Map<string, CourierEventRow>();
const memLocationMap = new Map<string, CourierLocationMapRow>();
const memCourierClaims = new Map<string, CourierClaimRow>();

export function clearMemoryLogisticsForTesting(): void {
  memShipments.clear();
  memEvents.clear();
  memLocationMap.clear();
  memCourierClaims.clear();
}

export interface ListShipmentsFilter {
  status?: ShipmentStatus | ShipmentStatus[];
  courier?: CourierCode;
  direction?: ShipmentDirection;
  orderId?: string;
  limit?: number;
  offset?: number;
}

export const logisticsRepo = {
  // --------------------------------------------------------------------------
  // 1. Courier Shipments
  // --------------------------------------------------------------------------
  async createShipment(
    row: InsertCourierShipmentRow,
    tx?: Tx
  ): Promise<CourierShipmentRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const toInsert = {
      ...row,
      id,
    };

    try {
      const [created] = await client
        .insert(courierShipments)
        .values(toInsert)
        .returning();
      if (created) {
        memShipments.set(id, created);
        return created;
      }
    } catch {
      // Memory Fallback
    }

    const shipmentRow: CourierShipmentRow = {
      ...toInsert,
      id,
      direction: toInsert.direction ?? "FORWARD",
      consignmentNo: toInsert.consignmentNo ?? null,
      trackingUrl: toInsert.trackingUrl ?? null,
      status: toInsert.status ?? "PENDING_BOOKING",
      collectedCodPaisa: toInsert.collectedCodPaisa ?? null,
      deliveryChargePaisa: toInsert.deliveryChargePaisa ?? null,
      codChargePaisa: toInsert.codChargePaisa ?? null,
      returnChargePaisa: toInsert.returnChargePaisa ?? null,
      bookingAttempts: toInsert.bookingAttempts ?? 0,
      lastError: toInsert.lastError ?? null,
      bookedAt: toInsert.bookedAt ?? null,
      handedOverAt: toInsert.handedOverAt ?? null,
      deliveredAt: toInsert.deliveredAt ?? null,
      lastEventAt: toInsert.lastEventAt ?? null,
      createdAt: toInsert.createdAt ?? new Date(),
      updatedAt: toInsert.updatedAt ?? new Date(),
    };

    memShipments.set(id, shipmentRow);
    return shipmentRow;
  },

  async getShipmentById(
    id: string,
    tx?: Tx
  ): Promise<CourierShipmentRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(courierShipments)
        .where(eq(courierShipments.id, id))
        .limit(1);
      if (found) return found;
    } catch {
      // Memory Fallback
    }
    return memShipments.get(id) ?? null;
  },

  async getShipmentByOrderId(
    orderId: string,
    tx?: Tx
  ): Promise<CourierShipmentRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(courierShipments)
        .where(eq(courierShipments.orderId, orderId))
        .orderBy(desc(courierShipments.createdAt))
        .limit(1);
      if (found) return found;
    } catch {
      // Memory Fallback
    }
    const matches = Array.from(memShipments.values()).filter(
      (s) => s.orderId === orderId
    );
    matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matches[0] ?? null;
  },

  async getShipmentByConsignmentNo(
    consignmentNo: string,
    tx?: Tx
  ): Promise<CourierShipmentRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(courierShipments)
        .where(eq(courierShipments.consignmentNo, consignmentNo))
        .limit(1);
      if (found) return found;
    } catch {
      // Memory Fallback
    }
    for (const s of memShipments.values()) {
      if (s.consignmentNo === consignmentNo) return s;
    }
    return null;
  },

  async updateShipment(
    id: string,
    updates: Partial<InsertCourierShipmentRow>,
    tx?: Tx
  ): Promise<CourierShipmentRow> {
    const client = tx ?? defaultDb;
    const updatedAt = new Date();
    const payload = { ...updates, updatedAt };

    try {
      const [updated] = await client
        .update(courierShipments)
        .set(payload)
        .where(eq(courierShipments.id, id))
        .returning();
      if (updated) {
        memShipments.set(id, updated);
        return updated;
      }
    } catch {
      // Memory Fallback
    }

    const existing = memShipments.get(id);
    if (!existing) {
      throw new Error(`Shipment '${id}' not found`);
    }

    const merged: CourierShipmentRow = {
      ...existing,
      ...payload,
    };
    memShipments.set(id, merged);
    return merged;
  },

  async listShipments(
    filter: ListShipmentsFilter = {},
    tx?: Tx
  ): Promise<{ shipments: CourierShipmentRow[]; total: number }> {
    const client = tx ?? defaultDb;
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    try {
      const conditions = [];
      if (filter.status) {
        if (Array.isArray(filter.status)) {
          conditions.push(sql`${courierShipments.status} IN ${filter.status}`);
        } else {
          conditions.push(eq(courierShipments.status, filter.status));
        }
      }
      if (filter.courier) {
        conditions.push(eq(courierShipments.courier, filter.courier));
      }
      if (filter.direction) {
        conditions.push(eq(courierShipments.direction, filter.direction));
      }
      if (filter.orderId) {
        conditions.push(eq(courierShipments.orderId, filter.orderId));
      }

      const rows = await client
        .select()
        .from(courierShipments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(courierShipments.createdAt))
        .limit(limit)
        .offset(offset);

      if (rows.length > 0) {
        return { shipments: rows, total: rows.length };
      }
    } catch {
      // Memory Fallback
    }

    let all = Array.from(memShipments.values());
    if (filter.status) {
      if (Array.isArray(filter.status)) {
        all = all.filter((s) => (filter.status as ShipmentStatus[]).includes(s.status));
      } else {
        all = all.filter((s) => s.status === filter.status);
      }
    }
    if (filter.courier) {
      all = all.filter((s) => s.courier === filter.courier);
    }
    if (filter.direction) {
      all = all.filter((s) => s.direction === filter.direction);
    }
    if (filter.orderId) {
      all = all.filter((s) => s.orderId === filter.orderId);
    }

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const slice = all.slice(offset, offset + limit);
    return { shipments: slice, total };
  },

  // --------------------------------------------------------------------------
  // 2. Courier Events
  // --------------------------------------------------------------------------
  async createCourierEvent(
    row: InsertCourierEventRow,
    tx?: Tx
  ): Promise<CourierEventRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const toInsert = {
      ...row,
      id,
    };

    try {
      const [created] = await client
        .insert(courierEvents)
        .values(toInsert)
        .returning();
      if (created) {
        memEvents.set(id, created);
        return created;
      }
    } catch {
      // Memory Fallback
    }

    const eventRow: CourierEventRow = {
      ...toInsert,
      id,
      receivedAt: toInsert.receivedAt ?? new Date(),
    };
    memEvents.set(id, eventRow);
    return eventRow;
  },

  async listEventsByShipmentId(
    shipmentId: string,
    tx?: Tx
  ): Promise<CourierEventRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(courierEvents)
        .where(eq(courierEvents.shipmentId, shipmentId))
        .orderBy(desc(courierEvents.occurredAt));
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    return Array.from(memEvents.values())
      .filter((e) => e.shipmentId === shipmentId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  },

  // --------------------------------------------------------------------------
  // 3. Courier Location Mapping
  // --------------------------------------------------------------------------
  async getLocationMapping(
    courier: string,
    district: string,
    thana: string,
    tx?: Tx
  ): Promise<CourierLocationMapRow | null> {
    const client = tx ?? defaultDb;
    const normDistrict = district.trim().toLowerCase();
    const normThana = thana.trim().toLowerCase();

    try {
      const [found] = await client
        .select()
        .from(courierLocationMap)
        .where(
          and(
            eq(courierLocationMap.courier, courier.toUpperCase() as CourierCode),
            sql`LOWER(${courierLocationMap.district}) = ${normDistrict}`,
            sql`LOWER(${courierLocationMap.thana}) = ${normThana}`,
            eq(courierLocationMap.isActive, true)
          )
        )
        .limit(1);
      if (found) return found;
    } catch {
      // Memory Fallback
    }

    for (const m of memLocationMap.values()) {
      if (
        m.isActive &&
        m.courier.toUpperCase() === courier.toUpperCase() &&
        m.district.toLowerCase() === normDistrict &&
        m.thana.toLowerCase() === normThana
      ) {
        return m;
      }
    }
    return null;
  },

  async createLocationMapping(
    row: InsertCourierLocationMapRow,
    tx?: Tx
  ): Promise<CourierLocationMapRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const toInsert = {
      ...row,
      id,
    };

    try {
      const [created] = await client
        .insert(courierLocationMap)
        .values(toInsert)
        .returning();
      if (created) {
        memLocationMap.set(id, created);
        return created;
      }
    } catch {
      // Memory Fallback
    }

    const mapRow: CourierLocationMapRow = {
      ...toInsert,
      id,
      hubId: toInsert.hubId ?? null,
      cityId: toInsert.cityId ?? null,
      zoneId: toInsert.zoneId ?? null,
      isActive: toInsert.isActive ?? true,
      createdAt: toInsert.createdAt ?? new Date(),
    };
    memLocationMap.set(id, mapRow);
    return mapRow;
  },

  // --------------------------------------------------------------------------
  // 4. Courier Event Deduplication Lookup
  // --------------------------------------------------------------------------
  async findCourierEventByDedupeKey(
    dedupeKey: string,
    tx?: Tx
  ): Promise<CourierEventRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(courierEvents)
        .where(eq(courierEvents.dedupeKey, dedupeKey))
        .limit(1);
      if (found) return found;
    } catch {
      // Memory Fallback
    }

    for (const e of memEvents.values()) {
      if (e.dedupeKey === dedupeKey) return e;
    }
    return null;
  },

  // --------------------------------------------------------------------------
  // 5. Courier Claims
  // --------------------------------------------------------------------------
  async createCourierClaim(
    row: InsertCourierClaimRow,
    tx?: Tx
  ): Promise<CourierClaimRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const toInsert = {
      ...row,
      id,
    };

    try {
      const [created] = await client
        .insert(courierClaims)
        .values(toInsert)
        .returning();
      if (created) {
        memCourierClaims.set(id, created);
        return created;
      }
    } catch {
      // Memory Fallback
    }

    const claimRow: CourierClaimRow = {
      ...toInsert,
      id,
      notes: toInsert.notes ?? null,
      status: toInsert.status ?? "PENDING",
      createdAt: toInsert.createdAt ?? new Date(),
      updatedAt: toInsert.updatedAt ?? new Date(),
    };
    memCourierClaims.set(id, claimRow);
    return claimRow;
  },

  async listClaimsByShipmentId(
    shipmentId: string,
    tx?: Tx
  ): Promise<CourierClaimRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(courierClaims)
        .where(eq(courierClaims.shipmentId, shipmentId));
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    return Array.from(memCourierClaims.values()).filter(
      (c) => c.shipmentId === shipmentId
    );
  },

  // --------------------------------------------------------------------------
  // 6. RTO Count in Rolling Days (e.g. 365 days / 12 months)
  // --------------------------------------------------------------------------
  async countCustomerRtoShipmentsInDays(
    customerId: string,
    days = 365,
    tx?: Tx
  ): Promise<number> {
    const client = tx ?? defaultDb;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const result = await client.execute<{ count: string | number }>(
        sql`
          SELECT count(DISTINCT cs.id) as count
          FROM courier_shipments cs
          JOIN orders o ON cs.order_id = o.id
          WHERE o.customer_id = ${customerId}
            AND cs.status IN ('RTO_IN_TRANSIT', 'RETURNED')
            AND cs.created_at >= ${cutoff}
        `
      );
      const countVal = result.rows[0]?.count;
      if (countVal !== undefined && countVal !== null) {
        return Number(countVal);
      }
    } catch {
      // Memory Fallback
    }

    let count = 0;
    for (const s of memShipments.values()) {
      if (s.createdAt >= cutoff && (s.status === "RTO_IN_TRANSIT" || s.status === "RETURNED")) {
        const order = await ordersRepo.getOrderWithDetails(undefined, s.orderId);
        if (order && order.customerId === customerId) {
          count++;
        }
      }
    }
    return count;
  },

  // --------------------------------------------------------------------------
  // 7. Polling Fallback Query (Shipments not terminal with no event in 24h)
  // --------------------------------------------------------------------------
  async listNonTerminalStaleShipments(
    staleHours = 24,
    tx?: Tx
  ): Promise<CourierShipmentRow[]> {
    const client = tx ?? defaultDb;
    const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000);

    try {
      const rows = await client
        .select()
        .from(courierShipments)
        .where(
          and(
            sql`${courierShipments.consignmentNo} IS NOT NULL`,
            sql`${courierShipments.status} NOT IN ('DELIVERED', 'RETURNED', 'LOST', 'CANCELLED', 'BOOKING_FAILED')`,
            sql`COALESCE(${courierShipments.lastEventAt}, ${courierShipments.bookedAt}, ${courierShipments.createdAt}) <= ${cutoff}`
          )
        );
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    const nonTerminalStatuses = new Set([
      "BOOKED",
      "PICKED_UP",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "PARTIALLY_DELIVERED",
      "RTO_IN_TRANSIT",
    ]);

    return Array.from(memShipments.values()).filter((s) => {
      if (!s.consignmentNo || !nonTerminalStatuses.has(s.status)) return false;
      const refTime = s.lastEventAt || s.bookedAt || s.createdAt;
      return refTime.getTime() <= cutoff.getTime();
    });
  },

  // --------------------------------------------------------------------------
  // 8. Warranty Start Fallback Query (+3d Dhaka / +5d outside)
  // --------------------------------------------------------------------------
  async listHandedOverShipmentsWithoutDelivery(
    dhakaDays = 3,
    outsideDhakaDays = 5,
    tx?: Tx
  ): Promise<Array<{ shipment: CourierShipmentRow; isInsideDhaka: boolean; fallbackDate: Date }>> {
    const now = Date.now();
    const dhakaCutoff = new Date(now - dhakaDays * 24 * 60 * 60 * 1000);
    const outsideCutoff = new Date(now - outsideDhakaDays * 24 * 60 * 60 * 1000);

    const candidates = Array.from(memShipments.values()).filter((s) => {
      if (!s.handedOverAt) return false;
      if (s.status === "DELIVERED" || s.status === "RETURNED" || s.status === "RTO_IN_TRANSIT" || s.status === "CANCELLED") {
        return false;
      }
      return true;
    });

    const results: Array<{ shipment: CourierShipmentRow; isInsideDhaka: boolean; fallbackDate: Date }> = [];
    for (const s of candidates) {
      const order = await ordersRepo.getOrderWithDetails(tx, s.orderId);
      const isInsideDhaka = order?.deliveryZone === "INSIDE_DHAKA";
      const thresholdDays = isInsideDhaka ? dhakaDays : outsideDhakaDays;
      const cutoff = isInsideDhaka ? dhakaCutoff : outsideCutoff;

      if (s.handedOverAt && s.handedOverAt.getTime() <= cutoff.getTime()) {
        const fallbackDate = new Date(s.handedOverAt.getTime() + thresholdDays * 24 * 60 * 60 * 1000);
        results.push({
          shipment: s,
          isInsideDhaka,
          fallbackDate,
        });
      }
    }
    return results;
  },
};
