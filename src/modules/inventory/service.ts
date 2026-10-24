import { Tx } from "@/lib/db";
import { Actor } from "@/lib/http/route";
import { ValidationError, NotFoundError, BusinessError } from "@/lib/errors";
import { emitOutbox } from "@/lib/outbox";
import { auditService } from "@/modules/audit";
import { sourcingService } from "@/modules/sourcing";
import { logger } from "@/lib/logger";
import { ledgerService, postingRules } from "@/modules/ledger";
import { inventoryRepo } from "./repo";
import {
  LocationCode,
  LocationRow,
  InventoryBalanceRow,
  StockMovementRow,
  StockReservationRow,
  StockAdjustmentRequestRow,
  CycleCountRow,
  CycleCountLineRow,
  ReceiveStockDto,
  TransferStockDto,
  ReserveStockItemDto,
  CreateAdjustmentRequestDto,
  AdjudicateAdjustmentDto,
  StartCycleCountDto,
  SubmitCycleCountLinesDto,
  InventoryBalanceFilterDto,
  StockMovementFilterDto,
  AllocateLineItem,
  AllocationResultItem,
  SkuAvailabilityStatus,
} from "./dto";
import {
  assertCanReadInventory,
  assertCanManageInventory,
  assertCanRequestAdjustment,
  assertCanApproveAdjustment,
} from "./policies";

export const RESERVATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function toAuditActorType(actor?: Actor | null): "STAFF" | "SYSTEM" | "CUSTOMER" {
  if (!actor) return "SYSTEM";
  if (actor.type === "staff") return "STAFF";
  if (actor.type === "customer") return "CUSTOMER";
  return "SYSTEM";
}

export const inventoryService = {
  /**
   * Seed canonical locations in DB & memory.
   */
  async seedLocations(tx?: Tx): Promise<void> {
    await inventoryRepo.seedLocations(tx);
  },

  /**
   * List all locations.
   */
  async listLocations(tx?: Tx): Promise<LocationRow[]> {
    return inventoryRepo.listLocations(tx);
  },

  /**
   * Get location by canonical code.
   */
  async getLocationByCode(
    code: LocationCode,
    tx?: Tx
  ): Promise<LocationRow> {
    const loc = await inventoryRepo.getLocationByCode(code, tx);
    if (!loc) {
      throw new NotFoundError(`Location with code '${code}' not found`);
    }
    return loc;
  },

  /**
   * List / filter inventory balances with location metadata.
   */
  async listBalances(
    filter: InventoryBalanceFilterDto,
    actor?: Actor | null,
    tx?: Tx
  ): Promise<{ items: Array<InventoryBalanceRow & { location: LocationRow }>; total: number }> {
    if (actor) assertCanReadInventory(actor);
    return inventoryRepo.listBalances(filter, tx);
  },

  /**
   * List / filter append-only stock movements.
   */
  async listMovements(
    filter: StockMovementFilterDto,
    actor?: Actor | null,
    tx?: Tx
  ): Promise<{ items: StockMovementRow[]; total: number }> {
    if (actor) assertCanReadInventory(actor);
    return inventoryRepo.listStockMovements(filter, tx);
  },

  /**
   * Receive physical stock at a location (on_hand += qty + append-only movement).
   */
  async receive(
    tx: Tx | undefined,
    params: ReceiveStockDto & { staffId?: string | null },
    actor?: Actor | null
  ): Promise<{ balance: InventoryBalanceRow; movement: StockMovementRow }> {
    if (actor) assertCanManageInventory(actor);

    const location = await this.getLocationByCode(params.locationCode, tx);
    const existing = await inventoryRepo.getBalance(params.skuId, location.id, tx);

    const updatedOnHand = (existing?.onHand ?? 0) + params.qty;
    const balance = await inventoryRepo.upsertBalance(
      {
        skuId: params.skuId,
        locationId: location.id,
        onHand: updatedOnHand,
        reserved: existing?.reserved ?? 0,
        safetyStock: existing?.safetyStock ?? 0,
      },
      tx
    );

    const movement = await inventoryRepo.createStockMovement(
      {
        skuId: params.skuId,
        fromLocationId: null,
        toLocationId: location.id,
        qty: params.qty,
        reason: params.reason ?? "PURCHASE_RECEIPT",
        refType: params.refType ?? "PURCHASE",
        refId: params.refId,
        unitCostPaisa: params.unitCostPaisa,
        staffId: params.staffId ?? actor?.id ?? null,
      },
      tx
    );

    // Availability state flip notification
    await this.checkAndEmitAvailabilityChange(params.skuId, tx);

    await emitOutbox(tx, {
      type: "inventory.stock_received",
      aggregateType: "inventory",
      aggregateId: params.skuId,
      payload: {
        skuId: params.skuId,
        locationCode: location.code,
        qty: params.qty,
        movementId: movement.id,
      },
    });

    return { balance, movement };
  },

  /**
   * Transfer physical stock between locations.
   */
  async transfer(
    tx: Tx | undefined,
    params: TransferStockDto & { staffId?: string | null },
    actor?: Actor | null
  ): Promise<{ movement: StockMovementRow }> {
    if (actor) assertCanManageInventory(actor);

    if (params.fromLocationCode === params.toLocationCode) {
      throw new ValidationError("From and To locations must be different");
    }

    const fromLoc = await this.getLocationByCode(params.fromLocationCode, tx);
    const toLoc = await this.getLocationByCode(params.toLocationCode, tx);

    const fromBalance = await inventoryRepo.getBalance(params.skuId, fromLoc.id, tx);
    const availableInFrom = (fromBalance?.onHand ?? 0) - (fromBalance?.reserved ?? 0);

    if (availableInFrom < params.qty) {
      throw new BusinessError(
        "ERR_INSUFFICIENT_STOCK",
        "Insufficient available stock to transfer",
        {
          skuId: params.skuId,
          locationCode: params.fromLocationCode,
          available: availableInFrom,
          requested: params.qty,
        }
      );
    }

    // Decrement from location
    await inventoryRepo.updateBalanceOnHandAndReserved(
      params.skuId,
      fromLoc.id,
      -params.qty,
      0,
      tx
    );

    // Increment to location
    const toBalance = await inventoryRepo.getBalance(params.skuId, toLoc.id, tx);
    await inventoryRepo.upsertBalance(
      {
        skuId: params.skuId,
        locationId: toLoc.id,
        onHand: (toBalance?.onHand ?? 0) + params.qty,
        reserved: toBalance?.reserved ?? 0,
        safetyStock: toBalance?.safetyStock ?? 0,
      },
      tx
    );

    // Append-only movement
    const movement = await inventoryRepo.createStockMovement(
      {
        skuId: params.skuId,
        fromLocationId: fromLoc.id,
        toLocationId: toLoc.id,
        qty: params.qty,
        reason: params.reason ?? "TRANSFER",
        refType: params.refType ?? "TRANSFER",
        refId: params.refId,
        unitCostPaisa: params.unitCostPaisa ?? 0,
        staffId: params.staffId ?? actor?.id ?? null,
      },
      tx
    );

    await this.checkAndEmitAvailabilityChange(params.skuId, tx);

    await emitOutbox(tx, {
      type: "inventory.stock_transferred",
      aggregateType: "inventory",
      aggregateId: params.skuId,
      payload: {
        skuId: params.skuId,
        fromLocationCode: fromLoc.code,
        toLocationCode: toLoc.code,
        qty: params.qty,
        movementId: movement.id,
      },
    });

    return { movement };
  },

  /**
   * Reserve stock inside checkout transaction:
   * EXACT SQL pattern from architechture.md §8.2.
   * Tries locations in preference order; returns reservation or null.
   */
  async reserve(
    tx: Tx | undefined,
    params: ReserveStockItemDto
  ): Promise<StockReservationRow | null> {
    for (const locCode of params.locationPreference) {
      const location = await this.getLocationByCode(locCode, tx);
      if (!location.isSellable) continue;

      const locked = await inventoryRepo.reserveBalance(
        params.skuId,
        location.id,
        params.qty,
        tx
      );

      if (locked) {
        const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
        const reservation = await inventoryRepo.createReservation(
          {
            orderId: params.orderId ?? null,
            cartHoldId: params.cartHoldId ?? null,
            orderItemId: params.orderItemId ?? null,
            skuId: params.skuId,
            locationId: location.id,
            qty: params.qty,
            status: "ACTIVE",
            expiresAt,
          },
          tx
        );

        await this.checkAndEmitAvailabilityChange(params.skuId, tx);

        await emitOutbox(tx, {
          type: "inventory.stock_reserved",
          aggregateType: "reservation",
          aggregateId: reservation.id,
          payload: {
            reservationId: reservation.id,
            orderId: reservation.orderId ?? undefined,
            cartHoldId: reservation.cartHoldId ?? undefined,
            skuId: reservation.skuId,
            locationCode: locCode,
            qty: reservation.qty,
            expiresAt: expiresAt.toISOString(),
          },
        });

        return reservation;
      }
    }

    return null;
  },

  /**
   * Commit reservation on payment/COD confirmation:
   * EXACT SQL pattern from architechture.md §8.2.
   * Decrements on_hand and reserved, writes SALE movement.
   * Returns true if 1 row committed, false if 0 rows (expired/already released).
   */
  async commit(
    tx: Tx | undefined,
    reservationId: string,
    staffId?: string | null
  ): Promise<boolean> {
    const committed = await inventoryRepo.commitReservation(reservationId, tx);
    if (!committed) {
      return false;
    }

    // Decrement on_hand and reserved
    await inventoryRepo.updateBalanceOnHandAndReserved(
      committed.skuId,
      committed.locationId,
      -committed.qty,
      -committed.qty,
      tx
    );

    // Record SALE movement
    await inventoryRepo.createStockMovement(
      {
        skuId: committed.skuId,
        fromLocationId: committed.locationId,
        toLocationId: null,
        qty: committed.qty,
        reason: "SALE",
        refType: "ORDER",
        refId: committed.orderId ?? committed.cartHoldId ?? committed.id,
        unitCostPaisa: 0,
        staffId: staffId ?? null,
      },
      tx
    );

    await this.checkAndEmitAvailabilityChange(committed.skuId, tx);

    await emitOutbox(tx, {
      type: "inventory.stock_committed",
      aggregateType: "reservation",
      aggregateId: committed.id,
      payload: {
        reservationId: committed.id,
        orderId: committed.orderId,
        skuId: committed.skuId,
        qty: committed.qty,
      },
    });

    return true;
  },

  /**
   * Get active reservations for an order.
   */
  async getActiveReservationsForOrder(
    orderId: string,
    tx?: Tx
  ): Promise<StockReservationRow[]> {
    return inventoryRepo.getActiveReservationsByOrderId(orderId, tx);
  },

  /**
   * Release reservation (by reservation ID or all active reservations for order ID).
   */
  async release(
    tx: Tx | undefined,
    target: { reservationId?: string; orderId?: string; cartHoldId?: string }
  ): Promise<number> {
    if (target.reservationId) {
      const released = await inventoryRepo.releaseReservation(
        target.reservationId,
        tx
      );
      if (!released) return 0;

      await inventoryRepo.updateBalanceOnHandAndReserved(
        released.skuId,
        released.locationId,
        0,
        -released.qty,
        tx
      );

      await this.checkAndEmitAvailabilityChange(released.skuId, tx);

      await emitOutbox(tx, {
        type: "inventory.stock_released",
        aggregateType: "reservation",
        aggregateId: released.id,
        payload: {
          reservationId: released.id,
          skuId: released.skuId,
          qty: released.qty,
        },
      });

      return 1;
    }

    if (target.orderId) {
      const releasedList = await inventoryRepo.releaseReservationsByOrderId(
        target.orderId,
        tx
      );
      for (const r of releasedList) {
        await inventoryRepo.updateBalanceOnHandAndReserved(
          r.skuId,
          r.locationId,
          0,
          -r.qty,
          tx
        );
        await this.checkAndEmitAvailabilityChange(r.skuId, tx);
      }
      return releasedList.length;
    }

    if (target.cartHoldId) {
      const releasedList = await inventoryRepo.releaseReservationsByCartHoldId(
        target.cartHoldId,
        tx
      );
      for (const r of releasedList) {
        await inventoryRepo.updateBalanceOnHandAndReserved(
          r.skuId,
          r.locationId,
          0,
          -r.qty,
          tx
        );
        await this.checkAndEmitAvailabilityChange(r.skuId, tx);
      }
      return releasedList.length;
    }

    return 0;
  },

  /**
   * Reservation Expiry Job (Runs every 1 min):
   * EXACT CTE from architechture.md §8.2.
   */
  async expireReservations(
    now: Date = new Date(),
    tx?: Tx
  ): Promise<{ expiredCount: number; affectedSkuIds: string[] }> {
    const res = await inventoryRepo.expireReservations(now, tx);

    for (const skuId of res.affectedSkuIds) {
      await this.checkAndEmitAvailabilityChange(skuId, tx);
    }

    if (res.expiredCount > 0) {
      await emitOutbox(tx, {
        type: "inventory.reservations_expired",
        aggregateType: "inventory",
        aggregateId: "expiry_job",
        payload: {
          expiredCount: res.expiredCount,
          timestamp: now.toISOString(),
        },
      });
    }

    return res;
  },

  /**
   * Allocation rule (PRD §3.11.3):
   * - Courier orders -> GODOWN_NAWABPUR then SHOWROOM_COUNTER
   * - Pickup orders -> SHOWROOM_COUNTER then GODOWN_NAWABPUR
   * - PRE_ORDER SKUs never allocate physical stock unless they are flash-deal physical units.
   * - Then virtual (P13); else not purchasable.
   */
  async allocate(
    orderType: "REGULAR_DROP_PACK" | "PRE_ORDER",
    channel: "COURIER" | "PICKUP" | "SHOWROOM_POS" | "WALK_IN" | "PHONE_ORDER",
    lines: AllocateLineItem[],
    tx?: Tx
  ): Promise<AllocationResultItem[]> {
    const results: AllocationResultItem[] = [];

    // Determine location preference order
    const locationPrefs: LocationCode[] =
      channel === "COURIER"
        ? ["GODOWN_NAWABPUR", "SHOWROOM_COUNTER"]
        : ["SHOWROOM_COUNTER", "GODOWN_NAWABPUR"];

    for (const line of lines) {
      const isPreorder = orderType === "PRE_ORDER" || line.isPreorder === true;
      const canUsePhysical = !isPreorder || line.isFlashDeal === true;

      let allocatedPhysical = false;

      if (canUsePhysical) {
        for (const locCode of locationPrefs) {
          const loc = await inventoryRepo.getLocationByCode(locCode, tx);
          if (!loc || !loc.isSellable) continue;

          const bal = await inventoryRepo.getBalance(line.skuId, loc.id, tx);
          const available = (bal?.onHand ?? 0) - (bal?.reserved ?? 0);

          if (available >= line.qty) {
            results.push({
              skuId: line.skuId,
              qty: line.qty,
              source: "PHYSICAL",
              locationCode: locCode,
              purchasable: true,
            });
            allocatedPhysical = true;
            break;
          }
        }
      }

      if (allocatedPhysical) continue;

      // Check virtual stock availability
      const isVirtuallyAvail = await sourcingService.isSkuVirtuallyAvailable(
        line.skuId
      );

      if (isVirtuallyAvail) {
        results.push({
          skuId: line.skuId,
          qty: line.qty,
          source: "VIRTUAL",
          purchasable: true,
        });
      } else {
        results.push({
          skuId: line.skuId,
          qty: line.qty,
          source: "UNAVAILABLE",
          purchasable: false,
        });
      }
    }

    return results;
  },

  /**
   * Product SKU Availability (implements P11 interface):
   * Physical sellable (on_hand - reserved) > 0 -> IN_STOCK;
   * else virtual -> AVAILABLE;
   * else OUT_OF_STOCK.
   */
  async availability(
    skuIds: string[],
    tx?: Tx
  ): Promise<Record<string, SkuAvailabilityStatus>> {
    if (skuIds.length === 0) return {};

    const sellableCounts = await inventoryRepo.getSellableBalancesForSkus(
      skuIds,
      tx
    );
    const sellableMap = new Map<string, number>();
    for (const row of sellableCounts) {
      sellableMap.set(row.skuId, row.sellableOnHand - row.sellableReserved);
    }

    const result: Record<string, SkuAvailabilityStatus> = {};

    for (const skuId of skuIds) {
      const sellableAvailable = sellableMap.get(skuId) ?? 0;
      if (sellableAvailable > 0) {
        result[skuId] = "IN_STOCK";
      } else {
        const isVirtual = await sourcingService.isSkuVirtuallyAvailable(skuId);
        result[skuId] = isVirtual ? "AVAILABLE" : "OUT_OF_STOCK";
      }
    }

    return result;
  },

  /**
   * Check if a SKU flipped availability state, and if so, emit outbox event.
   */
  async checkAndEmitAvailabilityChange(
    skuId: string,
    tx?: Tx
  ): Promise<SkuAvailabilityStatus> {
    const availMap = await this.availability([skuId], tx);
    const newStatus = availMap[skuId] ?? "OUT_OF_STOCK";

    await emitOutbox(tx, {
      type: "inventory.availability_changed",
      aggregateType: "sku",
      aggregateId: skuId,
      payload: {
        skuId,
        newStatus,
      },
    });

    return newStatus;
  },

  /**
   * Request stock adjustment (GODOWN_MANAGER).
   */
  async requestAdjustment(
    dto: CreateAdjustmentRequestDto,
    actor: Actor,
    tx?: Tx
  ): Promise<StockAdjustmentRequestRow> {
    assertCanRequestAdjustment(actor);

    const location = await this.getLocationByCode(dto.locationCode, tx);

    const request = await inventoryRepo.createAdjustmentRequest(
      {
        skuId: dto.skuId,
        locationId: location.id,
        delta: dto.delta,
        reason: dto.reason,
        requestedBy: actor.id,
        notes: dto.notes ?? null,
      },
      tx
    );

    await auditService.record(tx, {
      staffId: actor.id,
      actorType: toAuditActorType(actor),
      action: "stock.adjust.request",
      entityType: "stock_adjustment_request",
      entityId: request.id,
      beforeState: null,
      afterState: request as unknown as Record<string, unknown>,
    });

    await emitOutbox(tx, {
      type: "inventory.adjustment_requested",
      aggregateType: "stock_adjustment",
      aggregateId: request.id,
      payload: {
        requestId: request.id,
        skuId: request.skuId,
        delta: request.delta,
      },
    });

    return request;
  },

  /**
   * List adjustment requests.
   */
  async listAdjustmentRequests(
    filter: { status?: "PENDING" | "APPROVED" | "REJECTED"; skuId?: string; locationCode?: LocationCode },
    actor: Actor,
    tx?: Tx
  ): Promise<StockAdjustmentRequestRow[]> {
    assertCanReadInventory(actor);
    let locationId: string | undefined;
    if (filter.locationCode) {
      const loc = await this.getLocationByCode(filter.locationCode, tx);
      locationId = loc.id;
    }
    return inventoryRepo.listAdjustmentRequests(
      {
        status: filter.status,
        skuId: filter.skuId,
        locationId,
      },
      tx
    );
  },

  /**
   * Approve stock adjustment (FINANCE_OFFICER):
   * Modifies on_hand, creates movement, and hooks ledger write-off TODO(P17).
   */
  async approveAdjustment(
    id: string,
    dto: AdjudicateAdjustmentDto,
    actor: Actor,
    tx?: Tx
  ): Promise<StockAdjustmentRequestRow> {
    assertCanApproveAdjustment(actor);

    const request = await inventoryRepo.getAdjustmentRequestById(id, tx);
    if (!request) {
      throw new NotFoundError(`Stock adjustment request with ID '${id}' not found`);
    }
    if (request.status !== "PENDING") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Adjustment is already ${request.status}`
      );
    }

    const updated = await inventoryRepo.updateAdjustmentRequest(
      id,
      {
        status: "APPROVED",
        approvedBy: actor.id,
        approvedAt: new Date(),
        notes: dto.notes ?? request.notes,
      },
      tx
    );

    // Apply delta to balance
    const existingBal = await inventoryRepo.getBalance(
      request.skuId,
      request.locationId,
      tx
    );
    const newOnHand = (existingBal?.onHand ?? 0) + request.delta;
    await inventoryRepo.upsertBalance(
      {
        skuId: request.skuId,
        locationId: request.locationId,
        onHand: newOnHand,
        reserved: existingBal?.reserved ?? 0,
        safetyStock: existingBal?.safetyStock ?? 0,
      },
      tx
    );

    // Write movement
    const movementReason =
      request.delta > 0 ? "CYCLE_COUNT_ADJUSTMENT" : "WRITE_OFF";
    const movement = await inventoryRepo.createStockMovement(
      {
        skuId: request.skuId,
        fromLocationId: request.delta < 0 ? request.locationId : null,
        toLocationId: request.delta > 0 ? request.locationId : null,
        qty: Math.abs(request.delta),
        reason: movementReason,
        refType: "STOCK_ADJUSTMENT",
        refId: request.id,
        unitCostPaisa: 0,
        staffId: actor.id,
      },
      tx
    );

    // Ledger posting hook for write-offs (FINANCE_OFFICER double-entry ledger)
    if (movement && movement.unitCostPaisa && movement.unitCostPaisa > 0) {
      try {
        await ledgerService.post(
          tx,
          {
            eventType: "STOCK_WRITE_OFF",
            sourceType: "STOCK_ADJUSTMENT",
            sourceId: request.id,
            description: `Stock write-off approved for ${Math.abs(request.delta)} units of SKU ${request.skuId}: ${request.reason}`,
            lines: postingRules.STOCK_WRITE_OFF({
              costPaisa: movement.unitCostPaisa * Math.abs(request.delta),
            }),
          },
          actor
        );
      } catch (err) {
        logger.warn({ err, requestId: request.id }, "Failed to post ledger entry for stock write-off");
      }
    }

    await this.checkAndEmitAvailabilityChange(request.skuId, tx);

    await auditService.record(tx, {
      staffId: actor.id,
      actorType: toAuditActorType(actor),
      action: "stock.adjust.approve",
      entityType: "stock_adjustment_request",
      entityId: id,
      beforeState: request as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    });

    await emitOutbox(tx, {
      type: "inventory.adjustment_approved",
      aggregateType: "stock_adjustment",
      aggregateId: id,
      payload: {
        requestId: id,
        skuId: request.skuId,
        delta: request.delta,
        approvedBy: actor.id,
      },
    });

    return updated!;
  },

  /**
   * Reject stock adjustment (FINANCE_OFFICER).
   */
  async rejectAdjustment(
    id: string,
    dto: AdjudicateAdjustmentDto,
    actor: Actor,
    tx?: Tx
  ): Promise<StockAdjustmentRequestRow> {
    assertCanApproveAdjustment(actor);

    const request = await inventoryRepo.getAdjustmentRequestById(id, tx);
    if (!request) {
      throw new NotFoundError(`Stock adjustment request with ID '${id}' not found`);
    }
    if (request.status !== "PENDING") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Adjustment is already ${request.status}`
      );
    }

    const updated = await inventoryRepo.updateAdjustmentRequest(
      id,
      {
        status: "REJECTED",
        approvedBy: actor.id,
        approvedAt: new Date(),
        notes: dto.notes ?? request.notes,
      },
      tx
    );

    await auditService.record(tx, {
      staffId: actor.id,
      actorType: toAuditActorType(actor),
      action: "stock.adjust.reject",
      entityType: "stock_adjustment_request",
      entityId: id,
      beforeState: request as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    });

    return updated!;
  },

  /**
   * Nightly job 03:30:
   * Verify on_hand == sum(movements in) − sum(movements out) per (sku, location);
   * report mismatches as a Class A internal alert.
   */
  async runNightlyInventoryAudit(tx?: Tx): Promise<{
    checkedCombinations: number;
    mismatchesCount: number;
    mismatches: Array<{
      skuId: string;
      locationId: string;
      locationCode: string;
      onHand: number;
      movementNet: number;
      discrepancy: number;
    }>;
  }> {
    const allBalances = await inventoryRepo.getAllBalances(tx);
    const mismatches: Array<{
      skuId: string;
      locationId: string;
      locationCode: string;
      onHand: number;
      movementNet: number;
      discrepancy: number;
    }> = [];

    for (const b of allBalances) {
      const net = await inventoryRepo.getNetMovementsForLocationAndSku(
        b.skuId,
        b.locationId,
        tx
      );

      if (b.onHand !== net) {
        mismatches.push({
          skuId: b.skuId,
          locationId: b.locationId,
          locationCode: b.locationCode,
          onHand: b.onHand,
          movementNet: net,
          discrepancy: b.onHand - net,
        });
      }
    }

    if (mismatches.length > 0) {
      logger.error(
        { mismatchesCount: mismatches.length, mismatches },
        "CRITICAL: Nightly inventory audit reconciliation mismatch detected!"
      );

      await emitOutbox(tx, {
        type: "inventory.reconciliation_mismatch",
        aggregateType: "inventory",
        aggregateId: "nightly_audit",
        payload: {
          checkedCombinations: allBalances.length,
          mismatchesCount: mismatches.length,
          mismatches,
          auditedAt: new Date().toISOString(),
        },
        notificationClass: "A",
      });
    }

    return {
      checkedCombinations: allBalances.length,
      mismatchesCount: mismatches.length,
      mismatches,
    };
  },

  /**
   * Cycle Counts:
   * 1. Start cycle count
   */
  async startCycleCount(
    dto: StartCycleCountDto,
    actor: Actor,
    tx?: Tx
  ): Promise<CycleCountRow> {
    assertCanManageInventory(actor);

    const location = await this.getLocationByCode(dto.locationCode, tx);

    const count = await inventoryRepo.createCycleCount(
      {
        locationId: location.id,
        status: "IN_PROGRESS",
        startedBy: actor.id,
      },
      tx
    );

    return count;
  },

  /**
   * Cycle Counts:
   * 2. Submit counted lines
   */
  async submitCycleCountLines(
    countId: string,
    dto: SubmitCycleCountLinesDto,
    actor: Actor,
    tx?: Tx
  ): Promise<CycleCountLineRow[]> {
    assertCanManageInventory(actor);

    const count = await inventoryRepo.getCycleCountById(countId, tx);
    if (!count) {
      throw new NotFoundError(`Cycle count '${countId}' not found`);
    }
    if (count.status !== "IN_PROGRESS") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Cycle count is already ${count.status}`
      );
    }

    const linesToInsert: Array<{
      countId: string;
      skuId: string;
      systemQty: number;
      countedQty: number;
      variance: number;
    }> = [];

    for (const line of dto.lines) {
      const bal = await inventoryRepo.getBalance(line.skuId, count.locationId, tx);
      const systemQty = bal?.onHand ?? 0;
      const variance = line.countedQty - systemQty;

      linesToInsert.push({
        countId,
        skuId: line.skuId,
        systemQty,
        countedQty: line.countedQty,
        variance,
      });
    }

    return inventoryRepo.insertCycleCountLines(linesToInsert, tx);
  },

  /**
   * Cycle Counts:
   * 3. Complete cycle count
   */
  async completeCycleCount(
    countId: string,
    actor: Actor,
    tx?: Tx
  ): Promise<{ count: CycleCountRow; lines: CycleCountLineRow[] }> {
    assertCanManageInventory(actor);

    const count = await inventoryRepo.getCycleCountById(countId, tx);
    if (!count) {
      throw new NotFoundError(`Cycle count '${countId}' not found`);
    }
    if (count.status !== "IN_PROGRESS") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Cycle count is already ${count.status}`
      );
    }

    const updated = await inventoryRepo.updateCycleCount(
      countId,
      {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      tx
    );

    const lines = await inventoryRepo.getCycleCountLines(countId, tx);

    return { count: updated!, lines };
  },

  async getSellableBalancesForSkus(skuIds: string[], tx?: Tx) {
    return inventoryRepo.getSellableBalancesForSkus(skuIds, tx);
  },

  async getReservationsByCartHoldId(cartHoldId: string, tx?: Tx) {
    return inventoryRepo.getReservationsByCartHoldId(cartHoldId, tx);
  },

  async convertCartHoldReservations(cartHoldId: string, orderId: string, tx?: Tx) {
    return inventoryRepo.convertCartHoldReservationsToOrder(cartHoldId, orderId, tx);
  },

  clearMemoryForTesting(): void {
    inventoryRepo.clearMemoryForTesting();
  },
};
