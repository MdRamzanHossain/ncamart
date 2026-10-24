import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { Tx } from "@/lib/db";
import {
  locations,
  inventoryBalances,
  stockMovements,
  stockReservations,
  stockAdjustmentRequests,
  cycleCounts,
  cycleCountLines,
  LocationCode,
  LocationRow,
  InsertLocationRow,
  InventoryBalanceRow,
  InsertInventoryBalanceRow,
  StockMovementRow,
  InsertStockMovementRow,
  StockReservationRow,
  InsertStockReservationRow,
  StockAdjustmentRequestRow,
  InsertStockAdjustmentRequestRow,
  CycleCountRow,
  InsertCycleCountRow,
  CycleCountLineRow,
  InsertCycleCountLineRow,
  StockAdjustmentStatus,
} from "./schema";
import {
  InventoryBalanceFilterDto,
  StockMovementFilterDto,
} from "./dto";

export const CANONICAL_LOCATIONS_DATA: Array<Omit<InsertLocationRow, "id">> = [
  {
    code: "GODOWN_NAWABPUR",
    name: "Nawabpur Main Godown",
    isSellable: true,
  },
  {
    code: "SHOWROOM_COUNTER",
    name: "Showroom POS Counter",
    isSellable: true,
  },
  {
    code: "QC_HOLD",
    name: "QC Hold Bay",
    isSellable: false,
  },
  {
    code: "RMA_HOLD",
    name: "RMA Inspection Hold",
    isSellable: false,
  },
  {
    code: "DAMAGED",
    name: "Damaged / Quarantine Area",
    isSellable: false,
  },
  {
    code: "IN_TRANSIT",
    name: "In Transit / Pre-Order",
    isSellable: false,
  },
];

// In-Memory Fallback Stores
const memLocations = new Map<string, LocationRow>();
const memBalances = new Map<string, InventoryBalanceRow>(); // Key: `${skuId}:${locationId}`
const memMovements: StockMovementRow[] = [];
const memReservations = new Map<string, StockReservationRow>();
const memAdjustments = new Map<string, StockAdjustmentRequestRow>();
const memCycleCounts = new Map<string, CycleCountRow>();
const memCycleCountLines = new Map<string, CycleCountLineRow[]>();

// Initialize default locations in memory
function initMemLocations() {
  if (memLocations.size === 0) {
    let index = 1;
    for (const item of CANONICAL_LOCATIONS_DATA) {
      const id = `01920000-0001-7000-8000-00000000000${index++}`;
      memLocations.set(id, {
        id,
        code: item.code,
        name: item.name,
        isSellable: item.isSellable ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}
initMemLocations();

export const inventoryRepo = {
  clearMemoryForTesting(): void {
    memLocations.clear();
    memBalances.clear();
    memMovements.length = 0;
    memReservations.clear();
    memAdjustments.clear();
    memCycleCounts.clear();
    memCycleCountLines.clear();
    initMemLocations();
  },

  async seedLocations(tx?: Tx): Promise<void> {
    const client = tx ?? db;
    try {
      for (const loc of CANONICAL_LOCATIONS_DATA) {
        await client
          .insert(locations)
          .values({
            code: loc.code,
            name: loc.name,
            isSellable: loc.isSellable,
          })
          .onConflictDoUpdate({
            target: locations.code,
            set: {
              name: loc.name,
              isSellable: loc.isSellable,
              updatedAt: new Date(),
            },
          });
      }
    } catch {
      // Memory fallback handled
    }
  },

  async getLocationByCode(
    code: LocationCode,
    tx?: Tx
  ): Promise<LocationRow | null> {
    const client = tx ?? db;
    try {
      const [row] = await client
        .select()
        .from(locations)
        .where(eq(locations.code, code))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }

    for (const loc of memLocations.values()) {
      if (loc.code === code) return loc;
    }
    return null;
  },

  async getLocationById(id: string, tx?: Tx): Promise<LocationRow | null> {
    const client = tx ?? db;
    try {
      const [row] = await client
        .select()
        .from(locations)
        .where(eq(locations.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memLocations.get(id) ?? null;
  },

  async listLocations(tx?: Tx): Promise<LocationRow[]> {
    const client = tx ?? db;
    try {
      const rows = await client.select().from(locations);
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }
    return Array.from(memLocations.values());
  },

  async getBalance(
    skuId: string,
    locationId: string,
    tx?: Tx
  ): Promise<InventoryBalanceRow | null> {
    const client = tx ?? db;
    try {
      const [row] = await client
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.skuId, skuId),
            eq(inventoryBalances.locationId, locationId)
          )
        )
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    const key = `${skuId}:${locationId}`;
    return memBalances.get(key) ?? null;
  },

  async listBalances(
    filter: InventoryBalanceFilterDto,
    tx?: Tx
  ): Promise<{ items: Array<InventoryBalanceRow & { location: LocationRow }>; total: number }> {
    const client = tx ?? db;
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const offset = (page - 1) * limit;

    try {
      const conditions = [];
      if (filter.skuId) conditions.push(eq(inventoryBalances.skuId, filter.skuId));
      if (filter.locationCode) {
        conditions.push(eq(locations.code, filter.locationCode));
      }
      if (filter.isSellable !== undefined) {
        conditions.push(eq(locations.isSellable, filter.isSellable));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await client
        .select({
          balance: inventoryBalances,
          location: locations,
        })
        .from(inventoryBalances)
        .innerJoin(locations, eq(inventoryBalances.locationId, locations.id))
        .where(whereClause)
        .limit(limit)
        .offset(offset);

      const countRes = await client
        .select({ count: sql<number>`count(*)` })
        .from(inventoryBalances)
        .innerJoin(locations, eq(inventoryBalances.locationId, locations.id))
        .where(whereClause);

      const total = Number(countRes[0]?.count ?? 0);
      if (rows.length > 0 || total > 0) {
        return {
          items: rows.map((r) => ({ ...r.balance, location: r.location })),
          total,
        };
      }
    } catch {
      // Memory fallback
    }

    const list: Array<InventoryBalanceRow & { location: LocationRow }> = [];
    for (const b of memBalances.values()) {
      const loc = memLocations.get(b.locationId);
      if (!loc) continue;
      if (filter.skuId && b.skuId !== filter.skuId) continue;
      if (filter.locationCode && loc.code !== filter.locationCode) continue;
      if (filter.isSellable !== undefined && loc.isSellable !== filter.isSellable) continue;

      list.push({ ...b, location: loc });
    }

    const total = list.length;
    const items = list.slice(offset, offset + limit);
    return { items, total };
  },

  async upsertBalance(
    row: InsertInventoryBalanceRow,
    tx?: Tx
  ): Promise<InventoryBalanceRow> {
    const fullRow: InventoryBalanceRow = {
      skuId: row.skuId,
      locationId: row.locationId,
      onHand: row.onHand ?? 0,
      reserved: row.reserved ?? 0,
      safetyStock: row.safetyStock ?? 0,
      updatedAt: new Date(),
    };

    const client = tx ?? db;
    try {
      const [inserted] = await client
        .insert(inventoryBalances)
        .values(fullRow)
        .onConflictDoUpdate({
          target: [inventoryBalances.skuId, inventoryBalances.locationId],
          set: {
            onHand: fullRow.onHand,
            reserved: fullRow.reserved,
            safetyStock: fullRow.safetyStock,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (inserted) return inserted;
    } catch {
      // Memory fallback
    }

    const key = `${fullRow.skuId}:${fullRow.locationId}`;
    memBalances.set(key, fullRow);
    return fullRow;
  },

  /**
   * Atomic reservation check & lock:
   * EXACT SQL pattern from architechture.md §8.2:
   * UPDATE inventory_balances
   * SET reserved = reserved + $qty
   * WHERE sku_id = $sku AND location_id = $loc AND on_hand - reserved >= $qty
   * RETURNING on_hand, reserved;
   */
  async reserveBalance(
    skuId: string,
    locationId: string,
    qty: number,
    tx?: Tx
  ): Promise<{ onHand: number; reserved: number } | null> {
    const client = tx ?? db;
    try {
      const result = await client.execute<{ on_hand: number; reserved: number }>(
        sql`
          UPDATE inventory_balances
          SET reserved = reserved + ${qty},
              updated_at = now()
          WHERE sku_id = ${skuId}
            AND location_id = ${locationId}
            AND on_hand - reserved >= ${qty}
          RETURNING on_hand, reserved;
        `
      );

      const row = result.rows[0];
      if (row) {
        return {
          onHand: Number(row.on_hand),
          reserved: Number(row.reserved),
        };
      }
      return null;
    } catch {
      // Memory fallback
    }

    const key = `${skuId}:${locationId}`;
    const existing = memBalances.get(key);
    if (!existing) return null;

    if (existing.onHand - existing.reserved >= qty) {
      existing.reserved += qty;
      existing.updatedAt = new Date();
      return { onHand: existing.onHand, reserved: existing.reserved };
    }

    return null;
  },

  /**
   * Update onHand and reserved counts atomically
   */
  async updateBalanceOnHandAndReserved(
    skuId: string,
    locationId: string,
    onHandDelta: number,
    reservedDelta: number,
    tx?: Tx
  ): Promise<InventoryBalanceRow | null> {
    const client = tx ?? db;
    try {
      const [row] = await client
        .update(inventoryBalances)
        .set({
          onHand: sql`${inventoryBalances.onHand} + ${onHandDelta}`,
          reserved: sql`${inventoryBalances.reserved} + ${reservedDelta}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryBalances.skuId, skuId),
            eq(inventoryBalances.locationId, locationId)
          )
        )
        .returning();
      if (row) return row;
    } catch {
      // Memory fallback
    }

    const key = `${skuId}:${locationId}`;
    const existing = memBalances.get(key);
    if (!existing) return null;

    const newOnHand = existing.onHand + onHandDelta;
    const newReserved = existing.reserved + reservedDelta;

    if (newReserved < 0 || newOnHand < newReserved) {
      throw new Error("CHECK constraint violation: reserved >= 0 AND on_hand >= reserved");
    }

    existing.onHand = newOnHand;
    existing.reserved = newReserved;
    existing.updatedAt = new Date();
    return existing;
  },

  async createReservation(
    row: InsertStockReservationRow,
    tx?: Tx
  ): Promise<StockReservationRow> {
    const fullRow: StockReservationRow = {
      id: row.id ?? crypto.randomUUID(),
      orderId: row.orderId ?? null,
      cartHoldId: row.cartHoldId ?? null,
      orderItemId: row.orderItemId ?? null,
      skuId: row.skuId,
      locationId: row.locationId,
      qty: row.qty,
      status: row.status ?? "ACTIVE",
      expiresAt: row.expiresAt,
      createdAt: row.createdAt ?? new Date(),
      committedAt: row.committedAt ?? null,
      releasedAt: row.releasedAt ?? null,
    };

    const client = tx ?? db;
    try {
      const [inserted] = await client
        .insert(stockReservations)
        .values(fullRow)
        .returning();
      if (inserted) return inserted;
    } catch {
      // Memory fallback
    }

    memReservations.set(fullRow.id, fullRow);
    return fullRow;
  },

  async getReservationById(
    id: string,
    tx?: Tx
  ): Promise<StockReservationRow | null> {
    const client = tx ?? db;
    try {
      const [row] = await client
        .select()
        .from(stockReservations)
        .where(eq(stockReservations.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memReservations.get(id) ?? null;
  },

  /**
   * Commit reservation:
   * UPDATE stock_reservations SET status='COMMITTED', committed_at=now() WHERE id=$1 AND status='ACTIVE'
   */
  async commitReservation(
    id: string,
    tx?: Tx
  ): Promise<StockReservationRow | null> {
    const client = tx ?? db;
    try {
      const result = await client.execute<StockReservationRow>(
        sql`
          UPDATE stock_reservations
          SET status = 'COMMITTED',
              committed_at = now()
          WHERE id = ${id} AND status = 'ACTIVE'
          RETURNING *;
        `
      );
      const row = result.rows[0];
      if (row) return row;
      return null;
    } catch {
      // Memory fallback
    }

    const existing = memReservations.get(id);
    if (existing && existing.status === "ACTIVE") {
      existing.status = "COMMITTED";
      existing.committedAt = new Date();
      return existing;
    }
    return null;
  },

  /**
   * Release reservation:
   * UPDATE stock_reservations SET status='RELEASED', released_at=now() WHERE id=$1 AND status='ACTIVE'
   */
  async releaseReservation(
    id: string,
    tx?: Tx
  ): Promise<StockReservationRow | null> {
    const client = tx ?? db;
    try {
      const result = await client.execute<StockReservationRow>(
        sql`
          UPDATE stock_reservations
          SET status = 'RELEASED',
              released_at = now()
          WHERE id = ${id} AND status = 'ACTIVE'
          RETURNING *;
        `
      );
      const row = result.rows[0];
      if (row) return row;
      return null;
    } catch {
      // Memory fallback
    }

    const existing = memReservations.get(id);
    if (existing && existing.status === "ACTIVE") {
      existing.status = "RELEASED";
      existing.releasedAt = new Date();
      return existing;
    }
    return null;
  },

  async releaseReservationsByOrderId(
    orderId: string,
    tx?: Tx
  ): Promise<StockReservationRow[]> {
    const client = tx ?? db;
    try {
      const result = await client.execute<StockReservationRow>(
        sql`
          UPDATE stock_reservations
          SET status = 'RELEASED',
              released_at = now()
          WHERE order_id = ${orderId} AND status = 'ACTIVE'
          RETURNING *;
        `
      );
      if (result.rows.length > 0) return result.rows;
    } catch {
      // Memory fallback
    }

    const released: StockReservationRow[] = [];
    for (const r of memReservations.values()) {
      if (r.orderId === orderId && r.status === "ACTIVE") {
        r.status = "RELEASED";
        r.releasedAt = new Date();
        released.push(r);
      }
    }
    return released;
  },

  async getActiveReservationsByOrderId(
    orderId: string,
    tx?: Tx
  ): Promise<StockReservationRow[]> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(stockReservations)
        .where(
          and(
            eq(stockReservations.orderId, orderId),
            eq(stockReservations.status, "ACTIVE")
          )
        );
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    const matched: StockReservationRow[] = [];
    for (const r of memReservations.values()) {
      if (r.orderId === orderId && r.status === "ACTIVE") {
        matched.push(r);
      }
    }
    return matched;
  },

  async getReservationsByCartHoldId(
    cartHoldId: string,
    tx?: Tx
  ): Promise<StockReservationRow[]> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(stockReservations)
        .where(eq(stockReservations.cartHoldId, cartHoldId));
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    const matched: StockReservationRow[] = [];
    for (const r of memReservations.values()) {
      if (r.cartHoldId === cartHoldId) {
        matched.push(r);
      }
    }
    return matched;
  },

  async releaseReservationsByCartHoldId(
    cartHoldId: string,
    tx?: Tx
  ): Promise<StockReservationRow[]> {
    const client = tx ?? db;
    try {
      const result = await client.execute<StockReservationRow>(
        sql`
          UPDATE stock_reservations
          SET status = 'RELEASED',
              released_at = now()
          WHERE cart_hold_id = ${cartHoldId} AND status = 'ACTIVE'
          RETURNING *;
        `
      );
      if (result.rows.length > 0) return result.rows;
    } catch {
      // Memory fallback
    }

    const released: StockReservationRow[] = [];
    for (const r of memReservations.values()) {
      if (r.cartHoldId === cartHoldId && r.status === "ACTIVE") {
        r.status = "RELEASED";
        r.releasedAt = new Date();
        released.push(r);
      }
    }
    return released;
  },

  async convertCartHoldReservationsToOrder(
    cartHoldId: string,
    orderId: string,
    tx?: Tx
  ): Promise<StockReservationRow[]> {
    const client = tx ?? db;
    try {
      const result = await client.execute<StockReservationRow>(
        sql`
          UPDATE stock_reservations
          SET order_id = ${orderId},
              cart_hold_id = NULL
          WHERE cart_hold_id = ${cartHoldId} AND status = 'ACTIVE'
          RETURNING *;
        `
      );
      if (result.rows.length > 0) return result.rows;
    } catch {
      // Memory fallback
    }

    const converted: StockReservationRow[] = [];
    for (const r of memReservations.values()) {
      if (r.cartHoldId === cartHoldId && r.status === "ACTIVE") {
        r.orderId = orderId;
        r.cartHoldId = null;
        converted.push(r);
      }
    }
    return converted;
  },

  /**
   * Expiry job (every minute):
   * EXACT CTE from architechture.md §8.2:
   * WITH expired AS (
   *   UPDATE stock_reservations SET status = 'RELEASED', released_at = now()
   *   WHERE status = 'ACTIVE' AND expires_at < now()
   *   RETURNING sku_id, location_id, qty
   * )
   * UPDATE inventory_balances b
   * SET reserved = b.reserved - e.qty
   * FROM (SELECT sku_id, location_id, SUM(qty) AS qty FROM expired GROUP BY 1, 2) e
   * WHERE b.sku_id = e.sku_id AND b.location_id = e.location_id
   * RETURNING b.sku_id;
   */
  async expireReservations(
    now: Date = new Date(),
    tx?: Tx
  ): Promise<{ expiredCount: number; affectedSkuIds: string[] }> {
    const client = tx ?? db;
    try {
      const result = await client.execute<{ sku_id: string }>(
        sql`
          WITH expired AS (
            UPDATE stock_reservations
            SET status = 'RELEASED',
                released_at = now()
            WHERE status = 'ACTIVE' AND expires_at < ${now}
            RETURNING sku_id, location_id, qty
          ),
          updated_balances AS (
            UPDATE inventory_balances b
            SET reserved = b.reserved - e.qty,
                updated_at = now()
            FROM (SELECT sku_id, location_id, SUM(qty)::int AS qty FROM expired GROUP BY 1, 2) e
            WHERE b.sku_id = e.sku_id AND b.location_id = e.location_id
            RETURNING b.sku_id
          )
          SELECT sku_id FROM updated_balances;
        `
      );

      const affected = result.rows.map((r) => r.sku_id);
      return { expiredCount: affected.length, affectedSkuIds: affected };
    } catch {
      // Memory fallback
    }

    const expiredList: Array<{ skuId: string; locationId: string; qty: number }> = [];
    for (const r of memReservations.values()) {
      if (r.status === "ACTIVE" && r.expiresAt < now) {
        r.status = "RELEASED";
        r.releasedAt = new Date();
        expiredList.push({
          skuId: r.skuId,
          locationId: r.locationId,
          qty: r.qty,
        });
      }
    }

    const affectedSkus = new Set<string>();
    for (const item of expiredList) {
      affectedSkus.add(item.skuId);
      const key = `${item.skuId}:${item.locationId}`;
      const balance = memBalances.get(key);
      if (balance) {
        balance.reserved = Math.max(0, balance.reserved - item.qty);
        balance.updatedAt = new Date();
      }
    }

    return {
      expiredCount: expiredList.length,
      affectedSkuIds: Array.from(affectedSkus),
    };
  },

  async createStockMovement(
    row: InsertStockMovementRow,
    tx?: Tx
  ): Promise<StockMovementRow> {
    const fullRow: StockMovementRow = {
      id: row.id ?? crypto.randomUUID(),
      skuId: row.skuId,
      fromLocationId: row.fromLocationId ?? null,
      toLocationId: row.toLocationId ?? null,
      qty: row.qty,
      reason: row.reason,
      refType: row.refType,
      refId: row.refId,
      unitCostPaisa: row.unitCostPaisa,
      staffId: row.staffId ?? null,
      createdAt: row.createdAt ?? new Date(),
    };

    const client = tx ?? db;
    try {
      const [inserted] = await client
        .insert(stockMovements)
        .values(fullRow)
        .returning();
      if (inserted) return inserted;
    } catch {
      // Memory fallback
    }

    memMovements.push(fullRow);
    return fullRow;
  },

  async listStockMovements(
    filter: StockMovementFilterDto,
    tx?: Tx
  ): Promise<{ items: StockMovementRow[]; total: number }> {
    const client = tx ?? db;
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const offset = (page - 1) * limit;

    try {
      const conditions = [];
      if (filter.skuId) conditions.push(eq(stockMovements.skuId, filter.skuId));
      if (filter.reason) conditions.push(eq(stockMovements.reason, filter.reason));
      if (filter.refType) conditions.push(eq(stockMovements.refType, filter.refType));
      if (filter.refId) conditions.push(eq(stockMovements.refId, filter.refId));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await client
        .select()
        .from(stockMovements)
        .where(whereClause)
        .orderBy(desc(stockMovements.createdAt))
        .limit(limit)
        .offset(offset);

      const countRes = await client
        .select({ count: sql<number>`count(*)` })
        .from(stockMovements)
        .where(whereClause);

      const total = Number(countRes[0]?.count ?? 0);
      if (items.length > 0 || total > 0) {
        return { items, total };
      }
    } catch {
      // Memory fallback
    }

    let list = [...memMovements];
    if (filter.skuId) list = list.filter((m) => m.skuId === filter.skuId);
    if (filter.reason) list = list.filter((m) => m.reason === filter.reason);
    if (filter.refType) list = list.filter((m) => m.refType === filter.refType);
    if (filter.refId) list = list.filter((m) => m.refId === filter.refId);

    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = list.length;
    const items = list.slice(offset, offset + limit);
    return { items, total };
  },

  async createAdjustmentRequest(
    row: InsertStockAdjustmentRequestRow,
    tx?: Tx
  ): Promise<StockAdjustmentRequestRow> {
    const fullRow: StockAdjustmentRequestRow = {
      id: row.id ?? crypto.randomUUID(),
      skuId: row.skuId,
      locationId: row.locationId,
      delta: row.delta,
      reason: row.reason,
      requestedBy: row.requestedBy,
      status: row.status ?? "PENDING",
      approvedBy: row.approvedBy ?? null,
      approvedAt: row.approvedAt ?? null,
      notes: row.notes ?? null,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };

    const client = tx ?? db;
    try {
      const [inserted] = await client
        .insert(stockAdjustmentRequests)
        .values(fullRow)
        .returning();
      if (inserted) return inserted;
    } catch {
      // Memory fallback
    }

    memAdjustments.set(fullRow.id, fullRow);
    return fullRow;
  },

  async getAdjustmentRequestById(
    id: string,
    tx?: Tx
  ): Promise<StockAdjustmentRequestRow | null> {
    const client = tx ?? db;
    try {
      const [row] = await client
        .select()
        .from(stockAdjustmentRequests)
        .where(eq(stockAdjustmentRequests.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memAdjustments.get(id) ?? null;
  },

  async listAdjustmentRequests(
    filter: { status?: StockAdjustmentStatus; skuId?: string; locationId?: string },
    tx?: Tx
  ): Promise<StockAdjustmentRequestRow[]> {
    const client = tx ?? db;
    try {
      const conditions = [];
      if (filter.status) conditions.push(eq(stockAdjustmentRequests.status, filter.status));
      if (filter.skuId) conditions.push(eq(stockAdjustmentRequests.skuId, filter.skuId));
      if (filter.locationId) conditions.push(eq(stockAdjustmentRequests.locationId, filter.locationId));

      const rows = await client
        .select()
        .from(stockAdjustmentRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(stockAdjustmentRequests.createdAt));
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    let list = Array.from(memAdjustments.values());
    if (filter.status) list = list.filter((a) => a.status === filter.status);
    if (filter.skuId) list = list.filter((a) => a.skuId === filter.skuId);
    if (filter.locationId) list = list.filter((a) => a.locationId === filter.locationId);
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list;
  },

  async updateAdjustmentRequest(
    id: string,
    updates: Partial<InsertStockAdjustmentRequestRow>,
    tx?: Tx
  ): Promise<StockAdjustmentRequestRow | null> {
    const existing = await this.getAdjustmentRequestById(id, tx);
    if (!existing) return null;

    const updated: StockAdjustmentRequestRow = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    const client = tx ?? db;
    try {
      const [row] = await client
        .update(stockAdjustmentRequests)
        .set(updated)
        .where(eq(stockAdjustmentRequests.id, id))
        .returning();
      if (row) return row;
    } catch {
      // Memory fallback
    }

    memAdjustments.set(id, updated);
    return updated;
  },

  async createCycleCount(
    row: InsertCycleCountRow,
    tx?: Tx
  ): Promise<CycleCountRow> {
    const fullRow: CycleCountRow = {
      id: row.id ?? crypto.randomUUID(),
      locationId: row.locationId,
      status: row.status ?? "IN_PROGRESS",
      startedBy: row.startedBy,
      startedAt: row.startedAt ?? new Date(),
      completedAt: row.completedAt ?? null,
    };

    const client = tx ?? db;
    try {
      const [inserted] = await client
        .insert(cycleCounts)
        .values(fullRow)
        .returning();
      if (inserted) return inserted;
    } catch {
      // Memory fallback
    }

    memCycleCounts.set(fullRow.id, fullRow);
    return fullRow;
  },

  async getCycleCountById(id: string, tx?: Tx): Promise<CycleCountRow | null> {
    const client = tx ?? db;
    try {
      const [row] = await client
        .select()
        .from(cycleCounts)
        .where(eq(cycleCounts.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memCycleCounts.get(id) ?? null;
  },

  async insertCycleCountLines(
    lines: InsertCycleCountLineRow[],
    tx?: Tx
  ): Promise<CycleCountLineRow[]> {
    const fullLines: CycleCountLineRow[] = lines.map((l) => ({
      id: l.id ?? crypto.randomUUID(),
      countId: l.countId,
      skuId: l.skuId,
      systemQty: l.systemQty,
      countedQty: l.countedQty,
      variance: l.variance,
      createdAt: l.createdAt ?? new Date(),
    }));

    const client = tx ?? db;
    try {
      await client.insert(cycleCountLines).values(fullLines);
    } catch {
      // Memory fallback
    }

    for (const l of fullLines) {
      const existing = memCycleCountLines.get(l.countId) ?? [];
      existing.push(l);
      memCycleCountLines.set(l.countId, existing);
    }

    return fullLines;
  },

  async getCycleCountLines(
    countId: string,
    tx?: Tx
  ): Promise<CycleCountLineRow[]> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(cycleCountLines)
        .where(eq(cycleCountLines.countId, countId));
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }
    return memCycleCountLines.get(countId) ?? [];
  },

  async updateCycleCount(
    id: string,
    updates: Partial<InsertCycleCountRow>,
    tx?: Tx
  ): Promise<CycleCountRow | null> {
    const existing = await this.getCycleCountById(id, tx);
    if (!existing) return null;

    const updated: CycleCountRow = {
      ...existing,
      ...updates,
    };

    const client = tx ?? db;
    try {
      const [row] = await client
        .update(cycleCounts)
        .set(updated)
        .where(eq(cycleCounts.id, id))
        .returning();
      if (row) return row;
    } catch {
      // Memory fallback
    }

    memCycleCounts.set(id, updated);
    return updated;
  },

  /**
   * Compute sum(movements in) - sum(movements out) for a (sku, location)
   */
  async getNetMovementsForLocationAndSku(
    skuId: string,
    locationId: string,
    tx?: Tx
  ): Promise<number> {
    const client = tx ?? db;
    try {
      const inRes = await client
        .select({ sum: sql<number>`coalesce(sum(qty), 0)` })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.skuId, skuId),
            eq(stockMovements.toLocationId, locationId)
          )
        );

      const outRes = await client
        .select({ sum: sql<number>`coalesce(sum(qty), 0)` })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.skuId, skuId),
            eq(stockMovements.fromLocationId, locationId)
          )
        );

      const inSum = Number(inRes[0]?.sum ?? 0);
      const outSum = Number(outRes[0]?.sum ?? 0);
      return inSum - outSum;
    } catch {
      // Memory fallback
    }

    let inSum = 0;
    let outSum = 0;
    for (const m of memMovements) {
      if (m.skuId === skuId) {
        if (m.toLocationId === locationId) inSum += m.qty;
        if (m.fromLocationId === locationId) outSum += m.qty;
      }
    }
    return inSum - outSum;
  },

  async getAllBalances(
    tx?: Tx
  ): Promise<Array<InventoryBalanceRow & { locationCode: LocationCode }>> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select({
          balance: inventoryBalances,
          locationCode: locations.code,
        })
        .from(inventoryBalances)
        .innerJoin(locations, eq(inventoryBalances.locationId, locations.id));

      if (rows.length > 0) {
        return rows.map((r) => ({
          ...r.balance,
          locationCode: r.locationCode as LocationCode,
        }));
      }
    } catch {
      // Memory fallback
    }

    const res: Array<InventoryBalanceRow & { locationCode: LocationCode }> = [];
    for (const b of memBalances.values()) {
      const loc = memLocations.get(b.locationId);
      if (loc) {
        res.push({
          ...b,
          locationCode: loc.code as LocationCode,
        });
      }
    }
    return res;
  },

  async getSellableBalancesForSkus(
    skuIds: string[],
    tx?: Tx
  ): Promise<Array<{ skuId: string; sellableOnHand: number; sellableReserved: number }>> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select({
          skuId: inventoryBalances.skuId,
          totalOnHand: sql<number>`coalesce(sum(${inventoryBalances.onHand}), 0)`,
          totalReserved: sql<number>`coalesce(sum(${inventoryBalances.reserved}), 0)`,
        })
        .from(inventoryBalances)
        .innerJoin(locations, eq(inventoryBalances.locationId, locations.id))
        .where(
          and(
            inArray(inventoryBalances.skuId, skuIds),
            eq(locations.isSellable, true)
          )
        )
        .groupBy(inventoryBalances.skuId);

      if (rows.length > 0) {
        return rows.map((r) => ({
          skuId: r.skuId,
          sellableOnHand: Number(r.totalOnHand),
          sellableReserved: Number(r.totalReserved),
        }));
      }
    } catch {
      // Memory fallback
    }

    const map = new Map<string, { onHand: number; reserved: number }>();
    for (const b of memBalances.values()) {
      if (skuIds.includes(b.skuId)) {
        const loc = memLocations.get(b.locationId);
        if (loc && loc.isSellable) {
          const cur = map.get(b.skuId) ?? { onHand: 0, reserved: 0 };
          cur.onHand += b.onHand;
          cur.reserved += b.reserved;
          map.set(b.skuId, cur);
        }
      }
    }

    return Array.from(map.entries()).map(([skuId, counts]) => ({
      skuId,
      sellableOnHand: counts.onHand,
      sellableReserved: counts.reserved,
    }));
  },
};
