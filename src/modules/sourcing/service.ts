import { Actor } from "@/lib/http/route";
import { NotFoundError, ValidationError, ForbiddenError, BusinessError } from "@/lib/errors";
import { emitOutbox } from "@/lib/outbox";
import { auditService } from "@/modules/audit";
import { ordersService } from "@/modules/orders/service";
import { ordersRepo } from "@/modules/orders/repo";
import { catalogService } from "@/modules/catalog";
import { marginCheck } from "@/modules/orders/pricing/margin";
import { generateRunnerNumber } from "@/db/counters";
import { ledgerService, postingRules } from "@/modules/ledger";
import { inventoryService } from "@/modules/inventory/service";
import { mediaService } from "@/modules/media/service";
import {
  sourcingRepo,
} from "./repo";
import {
  SupplierRow,
  SupplierStockRow,
  SupplierQcBatchRow,
  SupplierQcOutcome,
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierFilterDto,
  SupplierStockItemDto,
  RecordQcBatchDto,
  SkuSupplierPriorityItem,
  RunnerTaskRow,
  InsertRunnerTaskRow,
  RunnerTaskFilterDto,
  RunnerTaskOverrideRequestDto,
  RunnerTaskAssignDto,
  RunnerTaskOverrideDecisionDto,
  StockoutChoiceDto,
  RunnerTaskPublicDto,
  RunnerFloatSessionRow,
  RunnerPurchaseRow,
  IssueFloatDto,
  CountFloatDto,
  FloatSignoffDto,
  ReturnFloatDto,
  ListFloatSessionsFilterDto,
  RunnerSyncBatchDto,
  RunnerSyncResponseDto,
  RunnerSyncItemResult,
  SingleTaskSyncPurchaseDto,
  ReceiptUploadUrlDto,
  ReceiveRunnerItemsDto,
  RUNNER_PURCHASE_APPROVAL_THRESHOLD_PAISA,
  runnerSyncPurchasePayloadSchema,
} from "./dto";
import {
  assertCanManageSuppliers,
  assertCanReadSuppliers,
  assertCanAccessRunnerTasks,
  assertCanManageSourcingTasks,
  assertCanManageFloat,
  assertCanReadFloat,
  assertCanSignoffFloat,
  assertCanRunRunner,
  assertCanReceiveGodown,
  assertCanApprovePurchase,
} from "./policies";

export const SUPPLIER_DEFECT_SUSPEND_BP = 300; // 3.00%
export const SUPPLIER_MIN_UNITS_FOR_AUTO_SUSPEND = 20;
export const STOCK_STALE_HOURS = 24;

function toAuditActorType(actor?: Actor | null): "STAFF" | "SYSTEM" | "CUSTOMER" {
  if (!actor) return "SYSTEM";
  if (actor.type === "staff") return "STAFF";
  if (actor.type === "customer") return "CUSTOMER";
  return "SYSTEM";
}

function toRunnerTaskActorType(actor?: Actor | null): "STAFF" | "RUNNER" | "SYSTEM" {
  if (!actor || actor.type === "system") return "SYSTEM";
  if (actor.roles?.includes("FIELD_RUNNER")) return "RUNNER";
  return "STAFF";
}

export const sourcingService = {
  /**
   * Create a new supplier (SOURCING_MANAGER or SUPER_ADMIN).
   */
  async createSupplier(
    dto: CreateSupplierDto,
    actor?: Actor | null
  ): Promise<SupplierRow> {
    if (actor) assertCanManageSuppliers(actor);

    const supplier = await sourcingRepo.createSupplier({
      name: dto.name,
      proprietorName: dto.proprietorName,
      market: dto.market,
      stallNo: dto.stallNo,
      floor: dto.floor,
      phone: dto.phone,
      bkashMerchantNumber: dto.bkashMerchantNumber ?? null,
      acceptedPaymentModes: dto.acceptedPaymentModes,
      status: "ACTIVE",
      totalUnitsSourced: 0,
      qcFailedUnits: 0,
      defectRateBp: 0,
    });

    // Audit log
    await auditService.record(undefined, {
      staffId: actor?.id ?? null,
      actorType: toAuditActorType(actor),
      action: "supplier.created",
      entityType: "supplier",
      entityId: supplier.id,
      beforeState: null,
      afterState: supplier as unknown as Record<string, unknown>,
    });

    // Domain event
    await emitOutbox(undefined, {
      type: "supplier.created",
      aggregateType: "supplier",
      aggregateId: supplier.id,
      payload: {
        supplierId: supplier.id,
        name: supplier.name,
        market: supplier.market,
      },
    });

    return supplier;
  },

  /**
   * Retrieve supplier by ID (SOURCING_MANAGER, GODOWN_MANAGER, SUPER_ADMIN).
   */
  async getSupplierById(
    id: string,
    actor?: Actor | null
  ): Promise<SupplierRow> {
    if (actor) assertCanReadSuppliers(actor);

    const supplier = await sourcingRepo.getSupplierById(id);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID '${id}' not found`);
    }
    return supplier;
  },

  /**
   * List suppliers with filters & pagination.
   */
  async listSuppliers(
    filter: SupplierFilterDto,
    actor?: Actor | null
  ): Promise<{ items: SupplierRow[]; total: number }> {
    if (actor) assertCanReadSuppliers(actor);
    return sourcingRepo.listSuppliers(filter);
  },

  /**
   * Update supplier details.
   */
  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    actor?: Actor | null
  ): Promise<SupplierRow> {
    if (actor) assertCanManageSuppliers(actor);

    const existing = await this.getSupplierById(id);
    const updated = await sourcingRepo.updateSupplier(id, dto);
    if (!updated) {
      throw new NotFoundError(`Supplier with ID '${id}' not found`);
    }

    await auditService.record(undefined, {
      staffId: actor?.id ?? null,
      actorType: toAuditActorType(actor),
      action: "supplier.updated",
      entityType: "supplier",
      entityId: id,
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    });

    await emitOutbox(undefined, {
      type: "supplier.updated",
      aggregateType: "supplier",
      aggregateId: id,
      payload: {
        supplierId: id,
        changes: dto,
      },
    });

    return updated;
  },

  /**
   * Suspend a supplier with an explicit reason.
   */
  async suspendSupplier(
    id: string,
    reason: string,
    actor?: Actor | null
  ): Promise<SupplierRow> {
    if (actor) assertCanManageSuppliers(actor);

    const existing = await this.getSupplierById(id);
    const updated = await sourcingRepo.updateSupplier(id, {
      status: "SUSPENDED",
      suspendedReason: reason,
    });

    if (!updated) {
      throw new NotFoundError(`Supplier with ID '${id}' not found`);
    }

    await auditService.record(undefined, {
      staffId: actor?.id ?? null,
      actorType: toAuditActorType(actor),
      action: "supplier.suspended",
      entityType: "supplier",
      entityId: id,
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    });

    await emitOutbox(undefined, {
      type: "supplier.suspended",
      aggregateType: "supplier",
      aggregateId: id,
      payload: {
        supplierId: id,
        reason,
        defectRateBp: updated.defectRateBp,
      },
      notificationClass: "A",
    });

    return updated;
  },

  /**
   * Reactivate a suspended supplier.
   */
  async reactivateSupplier(
    id: string,
    actor?: Actor | null
  ): Promise<SupplierRow> {
    if (actor) assertCanManageSuppliers(actor);

    const existing = await this.getSupplierById(id);
    const updated = await sourcingRepo.updateSupplier(id, {
      status: "ACTIVE",
      suspendedReason: null,
    });

    if (!updated) {
      throw new NotFoundError(`Supplier with ID '${id}' not found`);
    }

    await auditService.record(undefined, {
      staffId: actor?.id ?? null,
      actorType: toAuditActorType(actor),
      action: "supplier.reactivated",
      entityType: "supplier",
      entityId: id,
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    });

    await emitOutbox(undefined, {
      type: "supplier.reactivated",
      aggregateType: "supplier",
      aggregateId: id,
      payload: {
        supplierId: id,
      },
    });

    return updated;
  },

  /**
   * Bulk daily status confirmation for many SKUs for a given supplier.
   */
  async updateSupplierStock(
    supplierId: string,
    items: SupplierStockItemDto[],
    actor?: Actor | null
  ): Promise<SupplierStockRow[]> {
    if (actor) assertCanManageSuppliers(actor);

    // Verify supplier exists
    await this.getSupplierById(supplierId);

    const now = new Date();
    const rows = items.map((item) => ({
      supplierId,
      skuId: item.skuId,
      status: item.status,
      dailyOrderCap: item.dailyOrderCap ?? null,
      lastQuotedCostPaisa: item.lastQuotedCostPaisa ?? null,
      priority: item.priority ?? 1,
      confirmedAt: now,
      confirmedBy: actor?.id ?? null,
    }));

    const results = await sourcingRepo.upsertSupplierStock(rows);

    await auditService.record(undefined, {
      staffId: actor?.id ?? null,
      actorType: toAuditActorType(actor),
      action: "supplier.stock_updated",
      entityType: "supplier",
      entityId: supplierId,
      beforeState: null,
      afterState: { updatedSkuCount: items.length },
    });

    await emitOutbox(undefined, {
      type: "supplier.stock_updated",
      aggregateType: "supplier",
      aggregateId: supplierId,
      payload: {
        supplierId,
        skuCount: items.length,
        confirmedBy: actor?.id ?? null,
      },
    });

    return results;
  },

  /**
   * Get ordered primary/backup suppliers for a SKU.
   * Priority ordering:
   * 1. Priority ascending (1 = primary, 2 = backup)
   * 2. Active status (ACTIVE before SUSPENDED)
   * 3. Stock status (AVAILABLE > LIMITED > OUT)
   * 4. Lowest defect rate (defectRateBp ASC)
   * 5. Lowest quoted cost (lastQuotedCostPaisa ASC)
   */
  async getSuppliersForSku(
    skuId: string,
    actor?: Actor | null
  ): Promise<SkuSupplierPriorityItem[]> {
    if (actor) assertCanReadSuppliers(actor);

    const stocksWithSupplier = await sourcingRepo.listSupplierStocksForSku(skuId);

    const stockStatusRank: Record<string, number> = {
      AVAILABLE: 1,
      LIMITED: 2,
      OUT: 3,
    };

    const sorted = [...stocksWithSupplier].sort((a, b) => {
      // 1. Priority (1 = primary)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // 2. Supplier Active status
      const aActive = a.supplier.status === "ACTIVE" ? 0 : 1;
      const bActive = b.supplier.status === "ACTIVE" ? 0 : 1;
      if (aActive !== bActive) {
        return aActive - bActive;
      }

      // 3. Stock Status
      const aRank = stockStatusRank[a.status] ?? 99;
      const bRank = stockStatusRank[b.status] ?? 99;
      if (aRank !== bRank) {
        return aRank - bRank;
      }

      // 4. Defect rate (lower is better)
      if (a.supplier.defectRateBp !== b.supplier.defectRateBp) {
        return a.supplier.defectRateBp - b.supplier.defectRateBp;
      }

      // 5. Quoted cost (lower is better)
      const aCost = a.lastQuotedCostPaisa ?? Number.MAX_SAFE_INTEGER;
      const bCost = b.lastQuotedCostPaisa ?? Number.MAX_SAFE_INTEGER;
      return aCost - bCost;
    });

    return sorted.map((item) => ({
      supplier_id: item.supplier.id,
      supplier_name: item.supplier.name,
      market: item.supplier.market,
      stall_no: item.supplier.stallNo,
      floor: item.supplier.floor,
      phone: item.supplier.phone,
      status: item.supplier.status,
      stock_status: item.status,
      priority: item.priority,
      daily_order_cap: item.dailyOrderCap,
      last_quoted_cost_paisa: item.lastQuotedCostPaisa,
      confirmed_at: item.confirmedAt,
      defect_rate_bp: item.supplier.defectRateBp,
    }));
  },

  /**
   * Record QC Batch outcome.
   * Rule (PRD §10): If >= 3 of 5 units in a batch fail QC, the whole batch is returned.
   * Auto-suspend rule: If defect_rate_bp > 300 (3%) with >= 20 units sourced,
   * auto-suspend supplier & emit 'supplier.suspended' (Class A internal alert).
   */
  async recordQcBatch(
    params: RecordQcBatchDto & { supplierId: string },
    actor?: Actor | null
  ): Promise<{
    batch: SupplierQcBatchRow;
    supplier: SupplierRow;
    isAutoSuspended: boolean;
  }> {
    if (params.unitsTotal <= 0) {
      throw new ValidationError("Total units must be at least 1");
    }
    if (params.unitsFailed < 0 || params.unitsFailed > params.unitsTotal) {
      throw new ValidationError("Invalid units failed count");
    }

    const supplier = await this.getSupplierById(params.supplierId);

    // Batch 3-of-5 rule (PRD §10): if >= 3 of 5 units fail QC, whole batch is RETURNED
    const outcome: SupplierQcOutcome =
      params.unitsTotal >= 5 && params.unitsFailed >= 3
        ? "RETURNED"
        : "ACCEPTED";

    const batch = await sourcingRepo.createQcBatch({
      supplierId: params.supplierId,
      runnerTaskId: params.runnerTaskId ?? null,
      unitsTotal: params.unitsTotal,
      unitsFailed: params.unitsFailed,
      outcome,
    });

    // Update supplier QC counters
    const newTotalUnitsSourced = supplier.totalUnitsSourced + params.unitsTotal;
    const newQcFailedUnits = supplier.qcFailedUnits + params.unitsFailed;
    const newDefectRateBp = Math.round(
      (newQcFailedUnits / newTotalUnitsSourced) * 10000
    );

    const shouldAutoSuspend =
      newTotalUnitsSourced >= SUPPLIER_MIN_UNITS_FOR_AUTO_SUSPEND &&
      newDefectRateBp > SUPPLIER_DEFECT_SUSPEND_BP &&
      supplier.status === "ACTIVE";

    let updatedSupplier: SupplierRow;

    if (shouldAutoSuspend) {
      const suspended = await sourcingRepo.updateSupplier(supplier.id, {
        totalUnitsSourced: newTotalUnitsSourced,
        qcFailedUnits: newQcFailedUnits,
        defectRateBp: newDefectRateBp,
        status: "SUSPENDED",
        suspendedReason: `Auto-suspended: Defect rate (${(newDefectRateBp / 100).toFixed(2)}%) exceeded 3% threshold with ${newTotalUnitsSourced} units sourced`,
      });
      updatedSupplier = suspended!;

      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: toAuditActorType(actor),
        action: "supplier.auto_suspended",
        entityType: "supplier",
        entityId: supplier.id,
        beforeState: supplier as unknown as Record<string, unknown>,
        afterState: updatedSupplier as unknown as Record<string, unknown>,
      });

      await emitOutbox(undefined, {
        type: "supplier.suspended",
        aggregateType: "supplier",
        aggregateId: supplier.id,
        payload: {
          supplierId: supplier.id,
          reason: updatedSupplier.suspendedReason,
          defectRateBp: newDefectRateBp,
          totalUnitsSourced: newTotalUnitsSourced,
          qcFailedUnits: newQcFailedUnits,
          autoSuspended: true,
        },
        notificationClass: "A",
      });
    } else {
      const saved = await sourcingRepo.updateSupplier(supplier.id, {
        totalUnitsSourced: newTotalUnitsSourced,
        qcFailedUnits: newQcFailedUnits,
        defectRateBp: newDefectRateBp,
      });
      updatedSupplier = saved!;
    }

    await emitOutbox(undefined, {
      type: "supplier.qc_batch_recorded",
      aggregateType: "supplier",
      aggregateId: supplier.id,
      payload: {
        batchId: batch.id,
        supplierId: supplier.id,
        runnerTaskId: batch.runnerTaskId,
        unitsTotal: batch.unitsTotal,
        unitsFailed: batch.unitsFailed,
        outcome: batch.outcome,
        defectRateBp: newDefectRateBp,
        isAutoSuspended: shouldAutoSuspend,
      },
    });

    return {
      batch,
      supplier: updatedSupplier,
      isAutoSuspended: shouldAutoSuspend,
    };
  },

  /**
   * Helper function matching PRD specification: recordQcOutcome(supplierId, passed, failed)
   */
  async recordQcOutcome(
    supplierId: string,
    passed: number,
    failed: number,
    runnerTaskId?: string | null,
    actor?: Actor | null
  ): Promise<{
    batch: SupplierQcBatchRow;
    supplier: SupplierRow;
    isAutoSuspended: boolean;
  }> {
    const unitsTotal = passed + failed;
    return this.recordQcBatch(
      {
        supplierId,
        runnerTaskId,
        unitsTotal,
        unitsFailed: failed,
      },
      actor
    );
  },

  /**
   * Virtual availability: a SKU is virtually AVAILABLE if any ACTIVE supplier has
   * AVAILABLE or LIMITED (and the LIMITED daily cap is not reached today — count
   * today's confirmed orders that sourced this SKU virtually).
   * Also accounts for 24h stale degradation (unconfirmed > 24h treated as LIMITED).
   */
  async isSkuVirtuallyAvailable(skuId: string): Promise<boolean> {
    const stocksWithSupplier = await sourcingRepo.listSupplierStocksForSku(skuId);
    if (stocksWithSupplier.length === 0) return false;

    const now = Date.now();
    const staleThresholdMs = STOCK_STALE_HOURS * 60 * 60 * 1000;
    const todayConfirmedVirtualOrders =
      await sourcingRepo.getTodayConfirmedVirtualOrdersCount(skuId);

    for (const stock of stocksWithSupplier) {
      // 1. Supplier must be ACTIVE
      if (stock.supplier.status !== "ACTIVE") {
        continue;
      }

      // 2. Stock must not be OUT
      if (stock.status === "OUT") {
        continue;
      }

      // 3. Determine if stock status is degraded due to staleness (> 24h)
      const confirmedAgeMs = now - stock.confirmedAt.getTime();
      const isStale = confirmedAgeMs > staleThresholdMs;

      // Effective status: if confirmed within 24h and status === AVAILABLE -> AVAILABLE
      // otherwise treated as LIMITED
      const effectiveStatus =
        stock.status === "AVAILABLE" && !isStale ? "AVAILABLE" : "LIMITED";

      // 4. Check daily cap if status is LIMITED (or has a daily order cap)
      if (effectiveStatus === "LIMITED" || stock.dailyOrderCap !== null) {
        if (
          stock.dailyOrderCap !== null &&
          todayConfirmedVirtualOrders >= stock.dailyOrderCap
        ) {
          // Cap reached for today
          continue;
        }
      }

      // Found an active supplier meeting availability criteria!
      return true;
    }

    return false;
  },

  /**
   * Daily stale-status job (08:00):
   * Mark supplier_stock rows not confirmed in the last 24h as stale
   * and notify the Sourcing Manager.
   */
  async markStaleSupplierStock(): Promise<{ staleCount: number }> {
    const cutoffDate = new Date(Date.now() - STOCK_STALE_HOURS * 60 * 60 * 1000);
    const staleRows = await sourcingRepo.listStaleSupplierStock(cutoffDate);

    // If rows found, update them or emit event to notify sourcing manager
    if (staleRows.length > 0) {
      await emitOutbox(undefined, {
        type: "sourcing.supplier_stock_stale",
        aggregateType: "sourcing",
        aggregateId: "supplier_stock",
        payload: {
          staleCount: staleRows.length,
          checkedAt: new Date().toISOString(),
        },
        notificationClass: "B",
      });
    }

    return { staleCount: staleRows.length };
  },

  /**
   * P22: Check if any runner purchase has been recorded for any line item of an order.
   * Prevents customer cancellation once physical runner purchase has taken place.
   */
  async hasRunnerPurchaseForOrder(orderId: string): Promise<boolean> {
    return memRunnerPurchases.get(orderId) ?? false;
  },

  setRunnerPurchaseForTesting(orderId: string, hasPurchase: boolean): void {
    memRunnerPurchases.set(orderId, hasPurchase);
  },

  // --------------------------------------------------------------------------
  // P24 — Runner Tasks & Spot-Price Tolerance Lifecycle
  // --------------------------------------------------------------------------

  /**
   * 1. Create SOURCING tasks on 'sourcing.tasks_needed' for confirmed virtual lines.
   * Auto-assigns to on-shift runner with fewest open tasks; otherwise PENDING_ASSIGNMENT.
   */
  async createTasksForOrder(
    orderId: string,
    actor?: Actor | null
  ): Promise<{ tasks: RunnerTaskRow[]; unfulfillableItemsCount: number }> {
    const order = await ordersService.getOrderWithDetails(undefined, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    const virtualItems = order.items.filter(
      (i) => i.source === "VIRTUAL" && i.status === "ACTIVE"
    );

    const createdTasks: RunnerTaskRow[] = [];
    let unfulfillableItemsCount = 0;

    for (const item of virtualItems) {
      // Find active suppliers prioritized for this SKU
      const skuSuppliers = await this.getSuppliersForSku(item.skuId);
      const availableSuppliers = skuSuppliers.filter(
        (s) => s.status === "ACTIVE" && s.stock_status !== "OUT"
      );

      if (availableSuppliers.length === 0) {
        // Stockout! No supplier in market has this SKU
        unfulfillableItemsCount++;
        await emitOutbox(undefined, {
          type: "order.line_unfulfillable",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderItemId: item.id,
            skuId: item.skuId,
            reason: "No active supplier available for SKU in market",
            options: ["REFUND", "ALTERNATE", "BACKORDER"],
          },
          notificationClass: "A",
        });
        continue;
      }

      const primary = availableSuppliers[0]!;
      const backup = availableSuppliers[1] ?? null;

      // Base cost from stall or item
      const baseCostPaisa =
        primary.last_quoted_cost_paisa ?? item.unitCostPaisa ?? item.unitPricePaisa;

      // Spot tolerance max price = base_cost * (1 + 5% buffer)
      const maxUnitPricePaisa = Math.round(baseCostPaisa * 1.05);

      const taskNumber = await generateRunnerNumber(null);

      // Check on-shift runners (runners with open float session)
      const openSessions = await sourcingRepo.listOpenFloatSessions();
      let assignedRunnerId: string | null = null;
      let status: "DISPATCHED" | "PENDING_ASSIGNMENT" = "PENDING_ASSIGNMENT";

      if (openSessions.length > 0) {
        let minOpenTasks = Infinity;
        for (const s of openSessions) {
          const count = await sourcingRepo.countOpenTasksForRunner(s.runnerId);
          if (count < minOpenTasks) {
            minOpenTasks = count;
            assignedRunnerId = s.runnerId;
          }
        }
        status = "DISPATCHED";
      }

      const task = await sourcingRepo.createRunnerTask({
        taskNumber,
        taskType: "SOURCING",
        orderId: order.id,
        orderItemId: item.id,
        skuId: item.skuId,
        qty: item.qty,
        supplierId: primary.supplier_id,
        backupSupplierId: backup ? backup.supplier_id : null,
        maxUnitPricePaisa,
        runnerId: assignedRunnerId,
        status,
        dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // created + 2h
      });

      await sourcingRepo.createRunnerTaskEvent({
        taskId: task.id,
        eventType: "CREATED",
        actorType: toRunnerTaskActorType(actor),
        actorId: actor?.id ?? null,
        payload: {
          taskNumber,
          supplierId: primary.supplier_id,
          maxUnitPricePaisa,
        },
      });

      if (assignedRunnerId) {
        await sourcingRepo.createRunnerTaskEvent({
          taskId: task.id,
          eventType: "ASSIGNED",
          actorType: "SYSTEM",
          actorId: null,
          payload: { runnerId: assignedRunnerId },
        });

        await emitOutbox(undefined, {
          type: "sourcing.task_assigned",
          aggregateType: "sourcing_task",
          aggregateId: task.id,
          payload: {
            taskId: task.id,
            taskNumber: task.taskNumber,
            runnerId: assignedRunnerId,
            orderId: order.id,
            skuId: item.skuId,
          },
        });
      } else {
        // SSE alert to Sourcing Managers
        await emitOutbox(undefined, {
          type: "sourcing.unassigned_task_alert",
          aggregateType: "sourcing_task",
          aggregateId: task.id,
          payload: {
            taskId: task.id,
            taskNumber: task.taskNumber,
            orderId: order.id,
            skuId: item.skuId,
            message: "No runners currently on shift; task is pending assignment",
          },
          notificationClass: "A",
        });
      }

      createdTasks.push(task);
    }

    return { tasks: createdTasks, unfulfillableItemsCount };
  },

  /**
   * 2. List runner tasks with strict PII-masking for Field Runner App (PRD §3.9, api-spec §10.1).
   */
  async listRunnerTasks(
    filter?: RunnerTaskFilterDto,
    actor?: Actor | null
  ): Promise<{ items: RunnerTaskPublicDto[]; total: number }> {
    if (actor) assertCanAccessRunnerTasks(actor);

    // If runner actor, enforce filtering to own assigned tasks only
    const isRunner = actor?.roles?.includes("FIELD_RUNNER");
    const isManager =
      actor?.roles?.includes("SOURCING_MANAGER") || actor?.roles?.includes("SUPER_ADMIN");

    const effectiveFilter: RunnerTaskFilterDto = {
      ...filter,
      runnerId: isRunner && !isManager ? actor?.id : filter?.runnerId,
    };

    const { items, total } = await sourcingRepo.listRunnerTasks(effectiveFilter);

    const publicTasks: RunnerTaskPublicDto[] = [];
    for (const task of items) {
      const sku = await catalogService.getSkuById(task.skuId);
      const product = sku ? await catalogService.getProductById(sku.productId) : null;
      const supplier = await sourcingRepo.getSupplierById(task.supplierId);
      const backupSupplier = task.backupSupplierId
        ? await sourcingRepo.getSupplierById(task.backupSupplierId)
        : null;

      let orderNumber: string | null = null;
      if (task.orderId) {
        const order = await ordersService.getOrderWithDetails(undefined, task.orderId);
        orderNumber = order?.orderNumber ?? null;
      }

      publicTasks.push({
        id: task.id,
        task_number: task.taskNumber,
        task_type: task.taskType,
        status: task.status,
        order_number: orderNumber,
        sku_id: task.skuId,
        sku_code: sku?.skuCode ?? "UNKNOWN-SKU",
        title_en: product?.titleEn ?? "Industrial Accessory",
        title_bn: product?.titleBn ?? "শিল্প সরঞ্জাম",
        tier: product?.productTier ?? "AUTHENTIC",
        qty: task.qty,
        stall: {
          id: supplier?.id ?? task.supplierId,
          name: supplier?.name ?? "Nawabpur Stall",
          market: supplier?.market ?? "NAWABPUR_COMPLEX",
          stall_no: supplier?.stallNo ?? "",
          floor: supplier?.floor ?? "",
          phone: supplier?.phone ?? "",
          accepted_payment_modes: supplier?.acceptedPaymentModes ?? ["CASH"],
        },
        backup_stall: backupSupplier
          ? {
              id: backupSupplier.id,
              name: backupSupplier.name,
              market: backupSupplier.market,
              stall_no: backupSupplier.stallNo,
              floor: backupSupplier.floor,
              phone: backupSupplier.phone,
            }
          : null,
        max_unit_price_paisa: task.maxUnitPricePaisa,
        quoted_unit_price_paisa: task.quotedUnitPricePaisa,
        override_decision: task.overrideDecision,
        due_at: task.dueAt,
        created_at: task.createdAt,
      });
    }

    return { items: publicTasks, total };
  },

  /**
   * 3. Runner confirms stall contact: POST /api/v1/runner/tasks/:taskId/contacted
   */
  async markTaskContacted(
    taskId: string,
    actor: Actor
  ): Promise<RunnerTaskRow> {
    assertCanAccessRunnerTasks(actor);

    const task = await sourcingRepo.getRunnerTaskById(taskId);
    if (!task) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    const isRunner = actor.roles?.includes("FIELD_RUNNER");
    const isManager =
      actor.roles?.includes("SOURCING_MANAGER") || actor.roles?.includes("SUPER_ADMIN");
    if (isRunner && !isManager && task.runnerId !== actor.id) {
      throw new ForbiddenError("Cannot update task assigned to another runner");
    }

    const updated = await sourcingRepo.updateRunnerTask(taskId, {
      status: "STALL_CONTACTED",
    });

    if (!updated) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    await sourcingRepo.createRunnerTaskEvent({
      taskId,
      eventType: "CONTACTED",
      actorType: toRunnerTaskActorType(actor),
      actorId: actor.id,
      payload: { status: "STALL_CONTACTED" },
    });

    return updated;
  },

  /**
   * 4. Runner requests spot-price override: POST /api/v1/runner/tasks/:taskId/request-override
   * Evaluates marginCheck (P15). If allowed -> returns { allowed: true } immediately.
   * If not -> PRICE_EXCEEDED_PENDING + outbox 'sourcing.override_requested' + 5m escalation timer.
   */
  async requestOverride(
    taskId: string,
    dto: RunnerTaskOverrideRequestDto,
    actor: Actor
  ): Promise<{
    allowed: boolean;
    quoted_cost_paisa?: number;
    margin_bp?: number;
    status?: string;
    reason?: string;
  }> {
    assertCanAccessRunnerTasks(actor);

    const task = await sourcingRepo.getRunnerTaskById(taskId);
    if (!task) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    const isRunner = actor.roles?.includes("FIELD_RUNNER");
    const isManager =
      actor.roles?.includes("SOURCING_MANAGER") || actor.roles?.includes("SUPER_ADMIN");
    if (isRunner && !isManager && task.runnerId !== actor.id) {
      throw new ForbiddenError("Cannot request override for another runner's task");
    }

    // Load SKU and product catalog info for margin check
    const sku = await catalogService.getSkuById(task.skuId);
    const product = sku ? await catalogService.getProductById(sku.productId) : null;
    const vatRateBp = product?.vatRateBp ?? 0;

    // List price: item unit price or SKU price
    let listPricePaisa = sku?.pricePaisa ?? task.maxUnitPricePaisa;
    if (task.orderId && task.orderItemId) {
      const order = await ordersService.getOrderWithDetails(undefined, task.orderId);
      const item = order?.items.find((i) => i.id === task.orderItemId);
      if (item) {
        listPricePaisa = item.unitPricePaisa;
      }
    }

    // Base cost before 5% spot buffer: maxUnitPricePaisa = baseCost * 1.05
    const baseCostPaisa = Math.round(task.maxUnitPricePaisa / 1.05);

    // Call pure marginCheck from P15
    const result = marginCheck({
      listPricePaisa,
      vatRateBp,
      quotedUnitCostPaisa: dto.quoted_cost_paisa,
      baseCostPaisa,
      spotBufferBp: 500, // 5% spot tolerance buffer
      minMarginBp: 1500, // 15% minimum margin requirement
    });

    if (result.allowed) {
      // Within buffer tolerance and >= 15% margin! Automatically allowed.
      await sourcingRepo.updateRunnerTask(taskId, {
        quotedUnitPricePaisa: dto.quoted_cost_paisa,
        overrideReason: dto.reason,
      });

      await sourcingRepo.createRunnerTaskEvent({
        taskId,
        eventType: "OVERRIDE_AUTO_APPROVED",
        actorType: toRunnerTaskActorType(actor),
        actorId: actor.id,
        payload: {
          quotedCostPaisa: dto.quoted_cost_paisa,
          marginBp: result.marginBp,
          reason: dto.reason,
        },
      });

      return {
        allowed: true,
        quoted_cost_paisa: dto.quoted_cost_paisa,
        margin_bp: result.marginBp,
      };
    }

    // Exceeds spot tolerance or margin threshold -> transition to PRICE_EXCEEDED_PENDING
    const updated = await sourcingRepo.updateRunnerTask(taskId, {
      status: "PRICE_EXCEEDED_PENDING",
      quotedUnitPricePaisa: dto.quoted_cost_paisa,
      overrideReason: dto.reason,
      acknowledgedAt: null,
      escalatedAt: null,
    });

    await sourcingRepo.createRunnerTaskEvent({
      taskId,
      eventType: "OVERRIDE_REQUESTED",
      actorType: toRunnerTaskActorType(actor),
      actorId: actor.id,
      payload: {
        quotedCostPaisa: dto.quoted_cost_paisa,
        marginBp: result.marginBp,
        reason: dto.reason,
        overBuffer: result.overBuffer,
      },
    });

    // Outbox event -> SSE to SOURCING_MANAGER + 5-min delayed SMS/WhatsApp escalation
    await emitOutbox(undefined, {
      type: "sourcing.override_requested",
      aggregateType: "sourcing_task",
      aggregateId: taskId,
      payload: {
        taskId,
        taskNumber: task.taskNumber,
        runnerId: task.runnerId,
        quotedUnitPricePaisa: dto.quoted_cost_paisa,
        marginBp: result.marginBp,
        reason: dto.reason,
      },
      notificationClass: "A",
    });

    return {
      allowed: false,
      status: updated?.status ?? "PRICE_EXCEEDED_PENDING",
      margin_bp: result.marginBp,
      reason: result.overBuffer
        ? "Quoted cost exceeds spot tolerance buffer (>5%)"
        : "Gross margin drops below 15% threshold",
    };
  },

  /**
   * 5. Sourcing Manager list tasks with filters: GET /api/v1/admin/sourcing/tasks
   */
  async listAdminTasks(
    filter?: RunnerTaskFilterDto,
    actor?: Actor | null
  ): Promise<{ items: RunnerTaskRow[]; total: number }> {
    if (actor) assertCanManageSourcingTasks(actor);
    return sourcingRepo.listRunnerTasks(filter);
  },

  /**
   * 6. Sourcing Manager assign task: POST /api/v1/admin/sourcing/tasks/:taskId/assign
   */
  async assignTask(
    taskId: string,
    dto: RunnerTaskAssignDto,
    actor: Actor
  ): Promise<RunnerTaskRow> {
    assertCanManageSourcingTasks(actor);

    const task = await sourcingRepo.getRunnerTaskById(taskId);
    if (!task) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    const updated = await sourcingRepo.updateRunnerTask(taskId, {
      runnerId: dto.runner_id,
      status: "DISPATCHED",
    });

    if (!updated) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    await sourcingRepo.createRunnerTaskEvent({
      taskId,
      eventType: "ASSIGNED",
      actorType: toRunnerTaskActorType(actor),
      actorId: actor.id,
      payload: { runnerId: dto.runner_id },
    });

    await emitOutbox(undefined, {
      type: "sourcing.task_assigned",
      aggregateType: "sourcing_task",
      aggregateId: taskId,
      payload: {
        taskId,
        taskNumber: task.taskNumber,
        runnerId: dto.runner_id,
        orderId: task.orderId,
      },
    });

    return updated;
  },

  /**
   * 7. Sourcing Manager acknowledge override request: POST /api/v1/admin/sourcing/tasks/:taskId/acknowledge
   * Cancels the 5-min escalation timer.
   */
  async acknowledgeTask(
    taskId: string,
    actor: Actor
  ): Promise<RunnerTaskRow> {
    assertCanManageSourcingTasks(actor);

    const task = await sourcingRepo.getRunnerTaskById(taskId);
    if (!task) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    const updated = await sourcingRepo.updateRunnerTask(taskId, {
      acknowledgedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    await sourcingRepo.createRunnerTaskEvent({
      taskId,
      eventType: "ACKNOWLEDGED",
      actorType: toRunnerTaskActorType(actor),
      actorId: actor.id,
      payload: { acknowledgedAt: new Date().toISOString() },
    });

    return updated;
  },

  /**
   * 8. Sourcing Manager override decision: POST /api/v1/admin/sourcing/tasks/:taskId/override-decision
   * APPROVE -> runner cleared to buy at quoted price.
   * REROUTE -> status REROUTED, creates new task for backup stall.
   * DECLINE -> cancel task and trigger customer unfulfillable options flow.
   */
  async decideOverride(
    taskId: string,
    dto: RunnerTaskOverrideDecisionDto,
    actor: Actor
  ): Promise<{ task: RunnerTaskRow; decision: string; newTask?: RunnerTaskRow }> {
    assertCanManageSourcingTasks(actor);

    const task = await sourcingRepo.getRunnerTaskById(taskId);
    if (!task) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    const isApprove = dto.decision === "APPROVE" || dto.decision === "APPROVED";
    const isReroute = dto.decision === "REROUTE" || dto.decision === "REROUTED";

    if (isApprove) {
      const updated = await sourcingRepo.updateRunnerTask(taskId, {
        status: "STALL_CONTACTED",
        overrideDecision: "APPROVED",
        overrideDecidedBy: actor.id,
        maxUnitPricePaisa: task.quotedUnitPricePaisa ?? task.maxUnitPricePaisa,
      });

      await sourcingRepo.createRunnerTaskEvent({
        taskId,
        eventType: "OVERRIDE_APPROVED",
        actorType: toRunnerTaskActorType(actor),
        actorId: actor.id,
        payload: {
          approvedCostPaisa: task.quotedUnitPricePaisa,
        },
      });

      await emitOutbox(undefined, {
        type: "sourcing.override_approved",
        aggregateType: "sourcing_task",
        aggregateId: taskId,
        payload: {
          taskId,
          taskNumber: task.taskNumber,
          runnerId: task.runnerId,
          approvedCostPaisa: task.quotedUnitPricePaisa,
        },
      });

      return { task: updated!, decision: "APPROVED" };
    }

    if (isReroute) {
      const updated = await sourcingRepo.updateRunnerTask(taskId, {
        status: "REROUTED",
        overrideDecision: "REROUTED",
        overrideDecidedBy: actor.id,
      });

      await sourcingRepo.createRunnerTaskEvent({
        taskId,
        eventType: "OVERRIDE_REROUTED",
        actorType: toRunnerTaskActorType(actor),
        actorId: actor.id,
        payload: {
          backupSupplierId: dto.backup_supplier_id ?? task.backupSupplierId,
        },
      });

      const backupSupplierId = dto.backup_supplier_id ?? task.backupSupplierId;
      if (!backupSupplierId) {
        throw new ValidationError("No backup stall available to reroute task");
      }

      // Create new task for backup stall
      const newTaskNumber = await generateRunnerNumber(null);
      const newTask = await sourcingRepo.createRunnerTask({
        taskNumber: newTaskNumber,
        taskType: task.taskType,
        orderId: task.orderId,
        orderItemId: task.orderItemId,
        skuId: task.skuId,
        qty: task.qty,
        supplierId: backupSupplierId,
        backupSupplierId: null,
        maxUnitPricePaisa: task.maxUnitPricePaisa,
        runnerId: task.runnerId,
        status: task.runnerId ? "DISPATCHED" : "PENDING_ASSIGNMENT",
        dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });

      await sourcingRepo.createRunnerTaskEvent({
        taskId: newTask.id,
        eventType: "CREATED_VIA_REROUTE",
        actorType: toRunnerTaskActorType(actor),
        actorId: actor.id,
        payload: {
          originalTaskId: task.id,
          originalTaskNumber: task.taskNumber,
        },
      });

      await emitOutbox(undefined, {
        type: "sourcing.task_rerouted",
        aggregateType: "sourcing_task",
        aggregateId: taskId,
        payload: {
          originalTaskId: task.id,
          newTaskId: newTask.id,
          newTaskNumber: newTask.taskNumber,
          backupSupplierId,
        },
      });

      return { task: updated!, decision: "REROUTED", newTask };
    }

    // DECLINE: Task declined, trigger customer unfulfillable flow
    const updated = await sourcingRepo.updateRunnerTask(taskId, {
      status: "DECLINED",
      overrideDecision: "DECLINED",
      overrideDecidedBy: actor.id,
    });

    await sourcingRepo.createRunnerTaskEvent({
      taskId,
      eventType: "OVERRIDE_DECLINED",
      actorType: toRunnerTaskActorType(actor),
      actorId: actor.id,
      payload: { reason: "Spot price override declined by Sourcing Manager" },
    });

    if (task.orderId) {
      const order = await ordersService.getOrderWithDetails(undefined, task.orderId);
      if (order) {
        await emitOutbox(undefined, {
          type: "order.line_unfulfillable",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderItemId: task.orderItemId,
            skuId: task.skuId,
            reason: "Sourcing Manager declined stall price override; item unfulfillable",
            options: ["REFUND", "ALTERNATE", "BACKORDER"],
          },
          notificationClass: "A",
        });
      }
    }

    return { task: updated!, decision: "DECLINED" };
  },

  /**
   * 9. Customer / Support Stockout Choice (PRD §3.4.4):
   * POST /api/v1/orders/:orderNumber/lines/:lineId/stockout-choice
   * Choices:
   * - REFUND: Partial line refund; if other lines exist, order continues (EC-05). Delivery fee not re-charged.
   * - ALTERNATE: Switches line to alternate SKU and creates new sourcing task.
   * - BACKORDER: Records backorder agreement.
   */
  async handleStockoutChoice(
    orderNumber: string,
    lineId: string,
    dto: StockoutChoiceDto,
    actor?: Actor | null
  ): Promise<{
    orderNumber: string;
    lineId: string;
    choice: string;
    status: string;
    refund_amount_paisa?: number;
    alternate_sku_id?: string;
  }> {
    const order = await ordersService.getOrderByNumber(undefined, orderNumber);
    if (!order) {
      throw new NotFoundError(`Order '${orderNumber}' not found`);
    }

    if (actor && actor.type === "customer" && order.customerId !== actor.id) {
      throw new ForbiddenError("Cannot manage stockout choices for another customer's order");
    }

    const item = order.items.find((i) => i.id === lineId);
    if (!item) {
      throw new NotFoundError(`Order line '${lineId}' not found on order '${orderNumber}'`);
    }

    if (dto.choice === "REFUND") {
      // 1. Mark line CANCELLED
      await ordersRepo.updateOrderItem(undefined, item.id, {
        status: "CANCELLED",
      });

      // 2. Compute refund for this line
      const lineRefundPaisa = item.lineTotalPaisa - (item.allocatedDiscountPaisa ?? 0);

      // 3. Emit refund.requested
      await emitOutbox(undefined, {
        type: "refund.requested",
        aggregateType: "order",
        aggregateId: order.id,
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          amountPaisa: lineRefundPaisa,
          reason: "STOCKOUT_LINE_REFUND",
          lineId: item.id,
        },
      });

      // 4. Check if other active lines remain
      const remainingActive = order.items.filter(
        (i) => i.id !== lineId && i.status === "ACTIVE"
      );

      if (remainingActive.length === 0) {
        // Entire order cancelled
        await ordersService.transitionOrder(
          undefined as any,
          order.id,
          "CANCELLED_REFUNDED",
          actor ?? { id: "system", type: "system" },
          "All lines unfulfillable and cancelled by customer"
        );
      } else {
        // EC-05: Partial stockout. Order continues with remaining items.
        // Delivery fee is charged once only (not re-charged or modified).
        await emitOutbox(undefined, {
          type: "order.partial_stockout_continued",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            cancelledLineId: item.id,
            remainingLinesCount: remainingActive.length,
          },
        });
      }

      return {
        orderNumber,
        lineId,
        choice: "REFUND",
        status: "REFUND_REQUESTED",
        refund_amount_paisa: lineRefundPaisa,
      };
    }

    if (dto.choice === "ALTERNATE") {
      if (!dto.alternate_sku_id) {
        throw new ValidationError("alternate_sku_id is required when choice is ALTERNATE");
      }

      // Find suppliers for alternate SKU and create a new sourcing task
      const altSkuSuppliers = await this.getSuppliersForSku(dto.alternate_sku_id);
      const available = altSkuSuppliers.filter(
        (s) => s.status === "ACTIVE" && s.stock_status !== "OUT"
      );

      const supplierId = available[0]?.supplier_id ?? item.sourceLocationId ?? crypto.randomUUID();
      const newTaskNumber = await generateRunnerNumber(null);

      await sourcingRepo.createRunnerTask({
        taskNumber: newTaskNumber,
        taskType: "SOURCING",
        orderId: order.id,
        orderItemId: item.id,
        skuId: dto.alternate_sku_id,
        qty: item.qty,
        supplierId,
        maxUnitPricePaisa: item.unitPricePaisa,
        status: "PENDING_ASSIGNMENT",
        dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });

      return {
        orderNumber,
        lineId,
        choice: "ALTERNATE",
        alternate_sku_id: dto.alternate_sku_id,
        status: "SOURCING_ALTERNATE",
      };
    }

    if (dto.choice === "BACKORDER") {
      return {
        orderNumber,
        lineId,
        choice: "BACKORDER",
        status: "BACKORDERED",
      };
    }

    throw new ValidationError(`Unsupported stockout choice: ${dto.choice}`);
  },

  /**
   * 10. Sourcing completion: When a task is marked RECEIVED_AT_GODOWN (P25 receive step).
   * When all SOURCING tasks of an order are received at godown -> order moves SOURCING -> AT_GODOWN_QC.
   */
  async markTaskReceivedAtGodown(
    taskId: string,
    actor: Actor
  ): Promise<RunnerTaskRow> {
    assertCanAccessRunnerTasks(actor);

    const task = await sourcingRepo.getRunnerTaskById(taskId);
    if (!task) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    const updated = await sourcingRepo.updateRunnerTask(taskId, {
      status: "RECEIVED_AT_GODOWN",
    });

    if (!updated) {
      throw new NotFoundError(`Task '${taskId}' not found`);
    }

    await sourcingRepo.createRunnerTaskEvent({
      taskId,
      eventType: "RECEIVED_AT_GODOWN",
      actorType: toRunnerTaskActorType(actor),
      actorId: actor.id,
      payload: { status: "RECEIVED_AT_GODOWN" },
    });

    // Check if all sourcing tasks for this order are received at godown
    if (task.orderId) {
      const { items: orderTasks } = await sourcingRepo.listRunnerTasks({
        orderId: task.orderId,
      });

      const allReceived = orderTasks.every(
        (t) =>
          t.status === "RECEIVED_AT_GODOWN" ||
          t.status === "CANCELLED" ||
          t.status === "REROUTED"
      );

      if (allReceived && orderTasks.length > 0) {
        const order = await ordersService.getOrderWithDetails(undefined, task.orderId);
        if (order && order.status === "SOURCING") {
          await ordersService.transitionOrder(
            undefined as any,
            order.id,
            "AT_GODOWN_QC",
            actor,
            "All virtual sourcing items purchased and received at godown"
          );
        }
      }
    }

    return updated;
  },

  /**
   * 11. 5-Minute Escalation Background Worker:
   * Finds unacknowledged PRICE_EXCEEDED_PENDING override requests older than 5 minutes
   * and escalates via WhatsApp/SMS to Sourcing Manager (P36).
   */
  async runOverrideEscalationJob(
    now: Date = new Date()
  ): Promise<{ escalatedCount: number }> {
    const { items } = await sourcingRepo.listRunnerTasks({
      status: "PRICE_EXCEEDED_PENDING",
    });

    let escalatedCount = 0;
    const fiveMinutesMs = 5 * 60 * 1000;

    for (const task of items) {
      if (!task.acknowledgedAt && !task.escalatedAt) {
        const ageMs = now.getTime() - task.createdAt.getTime();
        if (ageMs >= fiveMinutesMs) {
          await sourcingRepo.updateRunnerTask(task.id, {
            escalatedAt: now,
          });

          await sourcingRepo.createRunnerTaskEvent({
            taskId: task.id,
            eventType: "ESCALATED",
            actorType: "SYSTEM",
            actorId: null,
            payload: {
              ageMinutes: Math.round(ageMs / 60000),
              escalatedAt: now.toISOString(),
            },
          });

          await emitOutbox(undefined, {
            type: "sourcing.override_escalated",
            aggregateType: "sourcing_task",
            aggregateId: task.id,
            payload: {
              taskId: task.id,
              taskNumber: task.taskNumber,
              runnerId: task.runnerId,
              quotedUnitPricePaisa: task.quotedUnitPricePaisa,
              reason: task.overrideReason,
              message: `Urgent: Spot price override on task ${task.taskNumber} unacknowledged after 5 minutes`,
            },
            notificationClass: "A", // Class A: Immediate SMS + WhatsApp dispatch
          });

          escalatedCount++;
        }
      }
    }

    return { escalatedCount };
  },

  /**
   * 12. Float Shift Management Helpers (for shift runner detection & tests)
   */
  async openFloatSession(
    runnerId: string,
    actor: Actor
  ): Promise<RunnerFloatSessionRow> {
    return sourcingRepo.createFloatSession({
      runnerId,
      status: "OPEN",
      openedBy: actor.id,
      openedAt: new Date(),
    });
  },

  // --------------------------------------------------------------------------
  // P25 Float Sessions Management (Finance & Runner)
  // --------------------------------------------------------------------------

  /**
   * POST /api/v1/finance/float/issue
   * Issues cash float to runner staff (FINANCE_OFFICER).
   * Posts double-entry ledger FLOAT_ISSUED (Dr 1020 Runner Float / Cr 1000 Cash - Office).
   */
  async issueFloatSession(
    dto: IssueFloatDto,
    actor: Actor
  ): Promise<RunnerFloatSessionRow> {
    assertCanManageFloat(actor);

    const session = await sourcingRepo.createFloatSession({
      runnerId: dto.runner_staff_id,
      issuedPaisa: dto.issued_float_paisa,
      purchasesCashPaisa: 0,
      supplierRefundsPaisa: 0,
      status: "OPEN",
      openedBy: actor.id,
      openedAt: new Date(),
    });

    // Ledger: Dr 1020 (Runner Float) / Cr 1000 (Office Cash)
    await ledgerService.post(
      undefined,
      {
        eventType: "FLOAT_ISSUED",
        sourceType: "FLOAT_SESSION",
        sourceId: session.id,
        description: `Float issued to runner ${session.runnerId}`,
        lines: postingRules.FLOAT_ISSUED({
          amountPaisa: dto.issued_float_paisa,
          runnerId: session.runnerId,
        }),
      },
      actor
    );

    await emitOutbox(undefined, {
      type: "sourcing.float_issued",
      aggregateType: "float_session",
      aggregateId: session.id,
      payload: {
        sessionId: session.id,
        runnerId: session.runnerId,
        issuedPaisa: session.issuedPaisa,
      },
    });

    return session;
  },

  /**
   * POST /api/v1/finance/float/:id/count
   * Finance officer counts the physical cash returned by the runner.
   * variance = issued − cash purchases + supplier cash refunds − returned.
   * If zero variance -> CLOSED + FLOAT_RETURNED entry.
   * If non-zero variance -> VARIANCE_REVIEW (requires both SM and FO sign-offs).
   */
  async countFloatSession(
    id: string,
    dto: CountFloatDto,
    actor: Actor
  ): Promise<RunnerFloatSessionRow> {
    assertCanManageFloat(actor);

    const session = await sourcingRepo.getFloatSessionById(id);
    if (!session) {
      throw new NotFoundError(`Float session '${id}' not found`);
    }

    if (session.status === "CLOSED") {
      throw new BusinessError(
        "ERR_FLOAT_SESSION_ALREADY_CLOSED",
        "Float session is already closed",
        { sessionId: id },
        400
      );
    }

    const expectedCash =
      session.issuedPaisa - session.purchasesCashPaisa + session.supplierRefundsPaisa;
    const variancePaisa = expectedCash - dto.returned_paisa;
    const now = new Date();

    if (variancePaisa === 0) {
      // Clean close: zero variance
      const updated = await sourcingRepo.updateFloatSession(id, {
        status: "CLOSED",
        countedBy: actor.id,
        countedAt: now,
        closedAt: now,
        returnedPaisa: dto.returned_paisa,
        variancePaisa: 0,
        varianceReason: dto.variance_reason ?? null,
      });

      if (dto.returned_paisa > 0) {
        await ledgerService.post(
          undefined,
          {
            eventType: "FLOAT_RETURNED",
            sourceType: "FLOAT_SESSION",
            sourceId: session.id,
            description: `Float returned by runner ${session.runnerId}`,
            lines: postingRules.FLOAT_RETURNED({
              amountPaisa: dto.returned_paisa,
              runnerId: session.runnerId,
            }),
          },
          actor
        );
      }

      await emitOutbox(undefined, {
        type: "sourcing.float_closed",
        aggregateType: "float_session",
        aggregateId: session.id,
        payload: {
          sessionId: session.id,
          runnerId: session.runnerId,
          returnedPaisa: dto.returned_paisa,
          variancePaisa: 0,
        },
      });

      return updated!;
    } else {
      // Variance detected -> moves to VARIANCE_REVIEW
      const updated = await sourcingRepo.updateFloatSession(id, {
        status: "VARIANCE_REVIEW",
        countedBy: actor.id,
        countedAt: now,
        returnedPaisa: dto.returned_paisa,
        variancePaisa,
        varianceReason: dto.variance_reason ?? null,
      });

      await emitOutbox(undefined, {
        type: "sourcing.float_variance_review",
        aggregateType: "float_session",
        aggregateId: session.id,
        payload: {
          sessionId: session.id,
          runnerId: session.runnerId,
          returnedPaisa: dto.returned_paisa,
          expectedCashPaisa: expectedCash,
          variancePaisa,
        },
        notificationClass: "A",
      });

      return updated!;
    }
  },

  /**
   * POST /api/v1/finance/float/:id/signoff
   * Sign-off on a session in VARIANCE_REVIEW.
   * Needs BOTH SOURCING_MANAGER and FINANCE_OFFICER sign-off before closing
   * with a CASH_SHORTAGE or CASH_OVERAGE entry.
   */
  async signoffFloatSession(
    id: string,
    actor: Actor,
    dto?: FloatSignoffDto
  ): Promise<RunnerFloatSessionRow> {
    assertCanSignoffFloat(actor);

    const session = await sourcingRepo.getFloatSessionById(id);
    if (!session) {
      throw new NotFoundError(`Float session '${id}' not found`);
    }

    if (session.status !== "VARIANCE_REVIEW") {
      throw new BusinessError(
        "ERR_INVALID_SESSION_STATUS",
        `Session is in status '${session.status}', expected 'VARIANCE_REVIEW'`,
        { sessionId: id, status: session.status },
        400
      );
    }

    const roles = actor.roles ?? [];
    const isSm = roles.includes("SOURCING_MANAGER");
    const isFo = roles.includes("FINANCE_OFFICER");
    const isSuper = roles.includes("SUPER_ADMIN");

    let smSignoffBy = session.smSignoffBy;
    let foSignoffBy = session.foSignoffBy;

    if (isSm) smSignoffBy = actor.id;
    if (isFo) foSignoffBy = actor.id;
    if (isSuper && !isSm && !isFo) {
      // Super admin can fulfill whichever sign-off is missing
      if (!smSignoffBy) smSignoffBy = actor.id;
      else if (!foSignoffBy) foSignoffBy = actor.id;
    }

    const bothSigned = !!smSignoffBy && !!foSignoffBy;
    const now = new Date();

    if (bothSigned) {
      // 1. Post FLOAT_RETURNED for any cash that was returned
      if (session.returnedPaisa && session.returnedPaisa > 0) {
        await ledgerService.post(
          undefined,
          {
            eventType: "FLOAT_RETURNED",
            sourceType: "FLOAT_SESSION",
            sourceId: session.id,
            description: `Float returned by runner ${session.runnerId}`,
            lines: postingRules.FLOAT_RETURNED({
              amountPaisa: session.returnedPaisa,
              runnerId: session.runnerId,
            }),
          },
          actor
        );
      }

      // 2. Post cash variance entry
      const variance = session.variancePaisa ?? 0;
      if (variance > 0) {
        // Cash shortage: Dr 5310 Cash Variance / Cr 1020 Runner Float
        await ledgerService.post(
          undefined,
          {
            eventType: "CASH_SHORTAGE",
            sourceType: "FLOAT_SESSION",
            sourceId: session.id,
            description: `Cash shortage on runner float ${session.id}`,
            lines: postingRules.CASH_SHORTAGE({
              amountPaisa: variance,
              location: "RUNNER",
              refId: session.runnerId,
            }),
          },
          actor
        );
      } else if (variance < 0) {
        // Cash overage: Dr 1020 Runner Float / Cr 5310 Cash Variance
        await ledgerService.post(
          undefined,
          {
            eventType: "CASH_OVERAGE",
            sourceType: "FLOAT_SESSION",
            sourceId: session.id,
            description: `Cash overage on runner float ${session.id}`,
            lines: postingRules.CASH_OVERAGE({
              amountPaisa: Math.abs(variance),
              location: "RUNNER",
              refId: session.runnerId,
            }),
          },
          actor
        );
      }

      await emitOutbox(undefined, {
        type: "sourcing.float_closed",
        aggregateType: "float_session",
        aggregateId: session.id,
        payload: {
          sessionId: session.id,
          runnerId: session.runnerId,
          returnedPaisa: session.returnedPaisa,
          variancePaisa: session.variancePaisa,
          closedWithBothSignoffs: true,
        },
      });
    }

    const updated = await sourcingRepo.updateFloatSession(id, {
      smSignoffBy,
      foSignoffBy,
      status: bothSigned ? "CLOSED" : "VARIANCE_REVIEW",
      closedAt: bothSigned ? now : null,
      varianceReason: dto?.notes
        ? `${session.varianceReason ? session.varianceReason + " | " : ""}${dto.notes}`
        : session.varianceReason,
    });

    return updated!;
  },

  /**
   * POST /api/v1/runner/float/return
   * Runner declares the return of their active cash float session (status PENDING_COUNT).
   */
  async returnFloatSession(
    actor: Actor,
    dto?: ReturnFloatDto
  ): Promise<RunnerFloatSessionRow> {
    assertCanRunRunner(actor);

    const session = await sourcingRepo.getActiveFloatSessionForRunner(actor.id);
    if (!session) {
      throw new BusinessError(
        "ERR_NO_ACTIVE_FLOAT_SESSION",
        "No active OPEN float session found for this runner",
        {},
        404
      );
    }

    const updated = await sourcingRepo.updateFloatSession(session.id, {
      status: "PENDING_COUNT",
      returnedPaisa: dto?.returned_paisa ?? session.returnedPaisa,
    });

    await emitOutbox(undefined, {
      type: "sourcing.float_return_declared",
      aggregateType: "float_session",
      aggregateId: session.id,
      payload: {
        sessionId: session.id,
        runnerId: session.runnerId,
        declaredReturnedPaisa: dto?.returned_paisa,
      },
    });

    return updated!;
  },

  /**
   * GET /api/v1/runner/float/current
   * Returns current float session for the authenticated runner.
   */
  async getCurrentFloatSession(
    actor: Actor
  ): Promise<(RunnerFloatSessionRow & { remaining_float_paisa: number }) | null> {
    assertCanRunRunner(actor);

    let session = await sourcingRepo.getActiveFloatSessionForRunner(actor.id);
    if (!session) {
      const { items } = await sourcingRepo.listFloatSessions({
        runnerId: actor.id,
        limit: 1,
      });
      if (items[0] && items[0].status !== "CLOSED") {
        session = items[0];
      }
    }

    if (!session) return null;

    const remainingFloatPaisa =
      session.issuedPaisa - session.purchasesCashPaisa + session.supplierRefundsPaisa;

    return {
      ...session,
      remaining_float_paisa: remainingFloatPaisa,
    };
  },

  /**
   * GET /api/v1/finance/float/sessions
   */
  async listFloatSessions(
    filter: ListFloatSessionsFilterDto,
    actor: Actor
  ): Promise<{ items: RunnerFloatSessionRow[]; total: number }> {
    assertCanReadFloat(actor);

    return sourcingRepo.listFloatSessions({
      status: filter.status,
      runnerId: filter.runner_id,
      from: filter.from ? new Date(filter.from) : undefined,
      to: filter.to ? new Date(filter.to) : undefined,
      page: filter.page,
      limit: filter.limit,
    });
  },

  /**
   * GET /api/v1/finance/float/variance-report
   */
  async getFloatVarianceReport(
    actor: Actor
  ): Promise<
    Array<{
      runnerId: string;
      totalSessions: number;
      totalIssuedPaisa: number;
      totalPurchasesCashPaisa: number;
      totalSupplierRefundsPaisa: number;
      totalReturnedPaisa: number;
      totalVariancePaisa: number;
      sessionsWithVariance: number;
    }>
  > {
    assertCanManageFloat(actor);
    return sourcingRepo.getFloatVarianceReport();
  },

  // --------------------------------------------------------------------------
  // P25 Offline-Safe Sync API (architechture.md §11.2)
  // --------------------------------------------------------------------------

  /**
   * POST /api/v1/runner/sync
   * Process EACH mutation in its own transaction.
   * Per-item result: { client_mutation_id, result: 'ok'|'conflict'|'quarantined'|'duplicate'|'error', server_ids, message }.
   */
  async syncMutations(
    batch: RunnerSyncBatchDto,
    actor: Actor,
    idempotencyKey?: string
  ): Promise<RunnerSyncResponseDto> {
    assertCanRunRunner(actor);

    const results: RunnerSyncItemResult[] = [];

    for (const mutation of batch.mutations) {
      try {
        // 1. Duplicate check: if clientMutationId already processed -> 'duplicate'
        const existingPurchase = await sourcingRepo.getRunnerPurchaseByClientMutationId(
          mutation.client_mutation_id
        );
        if (existingPurchase) {
          results.push({
            client_mutation_id: mutation.client_mutation_id,
            result: "duplicate",
            server_ids: { purchase_id: existingPurchase.id },
            message: "Duplicate client mutation ID already processed",
          });
          continue;
        }

        if (mutation.type === "PURCHASE") {
          const parsed = runnerSyncPurchasePayloadSchema.safeParse(mutation.payload);
          if (!parsed.success) {
            results.push({
              client_mutation_id: mutation.client_mutation_id,
              result: "error",
              message: `Validation error: ${parsed.error.message}`,
            });
            continue;
          }

          const payload = parsed.data;

          // Check device/session revoked -> 'quarantined'
          const isQuarantined =
            payload.device_revoked === true ||
            actor.roles?.includes("DEVICE_REVOKED") ||
            actor.sessionId === "revoked";

          if (isQuarantined) {
            const quarantinedPurchase = await sourcingRepo.createRunnerPurchase({
              clientMutationId: mutation.client_mutation_id,
              taskId: payload.task_id ?? null,
              floatSessionId: null,
              runnerId: actor.id,
              supplierId: payload.supplier_id,
              skuId: payload.sku_id,
              qty: payload.qty,
              unitCostPaisa: payload.unit_cost_paisa,
              amountPaisa: payload.amount_paisa,
              paymentMode: payload.payment_mode,
              receiptMediaId: payload.receipt_media_id ?? null,
              receiptMissingFlag: !payload.receipt_media_id || payload.receipt_missing_flag === true,
              requiresApproval: true,
              approvedBy: null,
              syncStatus: "QUARANTINED",
              recordedAt: new Date(mutation.recorded_at),
              receivedAt: new Date(),
            });

            await emitOutbox(undefined, {
              type: "sourcing.purchase_quarantined",
              aggregateType: "purchase",
              aggregateId: quarantinedPurchase.id,
              payload: {
                purchaseId: quarantinedPurchase.id,
                runnerId: actor.id,
                reason: "Device session revoked/expired",
              },
            });

            results.push({
              client_mutation_id: mutation.client_mutation_id,
              result: "quarantined",
              server_ids: { purchase_id: quarantinedPurchase.id },
              message: "Purchase quarantined for Sourcing Manager review",
            });
            continue;
          }

          // Check task cancelled or reassigned while offline -> 'conflict'
          let task: RunnerTaskRow | null = null;
          let isConflict = false;

          if (payload.task_id) {
            task = await sourcingRepo.getRunnerTaskById(payload.task_id);
            if (!task || task.status === "CANCELLED" || task.runnerId !== actor.id) {
              isConflict = true;
            }
          }

          const receiptMissing =
            !payload.receipt_media_id || payload.receipt_missing_flag === true;
          const requiresApproval =
            receiptMissing &&
            payload.amount_paisa > RUNNER_PURCHASE_APPROVAL_THRESHOLD_PAISA;

          const activeSession = await sourcingRepo.getActiveFloatSessionForRunner(actor.id);

          if (isConflict) {
            // CONFLICT PATH:
            // Accept the purchase, receive the item into GODOWN_NAWABPUR physical stock (RUNNER_CONFLICT_RECEIPT),
            // notify Sourcing Manager
            const conflictPurchase = await sourcingRepo.createRunnerPurchase({
              clientMutationId: mutation.client_mutation_id,
              taskId: payload.task_id ?? null,
              floatSessionId: activeSession?.id ?? null,
              runnerId: actor.id,
              supplierId: payload.supplier_id,
              skuId: payload.sku_id,
              qty: payload.qty,
              unitCostPaisa: payload.unit_cost_paisa,
              amountPaisa: payload.amount_paisa,
              paymentMode: payload.payment_mode,
              receiptMediaId: payload.receipt_media_id ?? null,
              receiptMissingFlag: receiptMissing,
              requiresApproval,
              approvedBy: null,
              syncStatus: "CONFLICT",
              recordedAt: new Date(mutation.recorded_at),
              receivedAt: new Date(),
            });

            if (payload.payment_mode === "CASH" && activeSession) {
              await sourcingRepo.updateFloatSession(activeSession.id, {
                purchasesCashPaisa: activeSession.purchasesCashPaisa + payload.amount_paisa,
              });
            }

            // Receive into GODOWN_NAWABPUR with RUNNER_CONFLICT_RECEIPT
            await inventoryService.receive(
              undefined,
              {
                skuId: payload.sku_id,
                locationCode: "GODOWN_NAWABPUR",
                qty: payload.qty,
                unitCostPaisa: payload.unit_cost_paisa,
                reason: "RUNNER_CONFLICT_RECEIPT",
                refType: "RUNNER_CONFLICT_RECEIPT",
                refId: conflictPurchase.id,
                staffId: actor.id,
              },
              undefined
            );

            // Post Ledger
            if (payload.payment_mode === "CASH") {
              await ledgerService.post(
                undefined,
                {
                  eventType: "RUNNER_CASH_PURCHASE",
                  sourceType: "RUNNER_PURCHASE",
                  sourceId: conflictPurchase.id,
                  description: `Conflict cash purchase accepted for stock`,
                  lines: postingRules.RUNNER_CASH_PURCHASE({
                    amountPaisa: payload.amount_paisa,
                    runnerId: actor.id,
                  }),
                },
                actor
              );
            } else {
              await ledgerService.post(
                undefined,
                {
                  eventType: "SUPPLIER_CREDIT_PURCHASE",
                  sourceType: "RUNNER_PURCHASE",
                  sourceId: conflictPurchase.id,
                  description: `Conflict credit purchase accepted for stock`,
                  lines: postingRules.SUPPLIER_CREDIT_PURCHASE({
                    amountPaisa: payload.amount_paisa,
                    supplierId: payload.supplier_id,
                  }),
                },
                actor
              );
            }

            await emitOutbox(undefined, {
              type: "sourcing.purchase_conflict",
              aggregateType: "purchase",
              aggregateId: conflictPurchase.id,
              payload: {
                purchaseId: conflictPurchase.id,
                taskId: payload.task_id,
                runnerId: actor.id,
                skuId: payload.sku_id,
                qty: payload.qty,
                amountPaisa: payload.amount_paisa,
                message: "Runner purchased cancelled or reassigned task offline",
              },
              notificationClass: "B",
            });

            results.push({
              client_mutation_id: mutation.client_mutation_id,
              result: "conflict",
              server_ids: { purchase_id: conflictPurchase.id },
              message: "Task was cancelled/reassigned offline; purchase accepted into godown stock",
            });
            continue;
          }

          // NORMAL OK PATH:
          const purchase = await sourcingRepo.createRunnerPurchase({
            clientMutationId: mutation.client_mutation_id,
            taskId: payload.task_id ?? null,
            floatSessionId: activeSession?.id ?? null,
            runnerId: actor.id,
            supplierId: payload.supplier_id,
            skuId: payload.sku_id,
            qty: payload.qty,
            unitCostPaisa: payload.unit_cost_paisa,
            amountPaisa: payload.amount_paisa,
            paymentMode: payload.payment_mode,
            receiptMediaId: payload.receipt_media_id ?? null,
            receiptMissingFlag: receiptMissing,
            requiresApproval,
            approvedBy: null,
            syncStatus: "OK",
            recordedAt: new Date(mutation.recorded_at),
            receivedAt: new Date(),
          });

          if (payload.payment_mode === "CASH" && activeSession) {
            await sourcingRepo.updateFloatSession(activeSession.id, {
              purchasesCashPaisa: activeSession.purchasesCashPaisa + payload.amount_paisa,
            });
          }

          // Update Task status to PURCHASED
          if (task) {
            await sourcingRepo.updateRunnerTask(task.id, {
              status: "PURCHASED",
              quotedUnitPricePaisa: payload.unit_cost_paisa,
            });

            await sourcingRepo.createRunnerTaskEvent({
              taskId: task.id,
              eventType: "PURCHASED",
              actorType: "RUNNER",
              actorId: actor.id,
              payload: {
                purchaseId: purchase.id,
                amountPaisa: payload.amount_paisa,
                unitCostPaisa: payload.unit_cost_paisa,
              },
            });

            // Set order_item.unit_cost_paisa
            if (task.orderItemId) {
              await ordersRepo.updateOrderItem(undefined, task.orderItemId, {
                unitCostPaisa: payload.unit_cost_paisa,
              });
            }
          }

          // Post Ledger
          if (payload.payment_mode === "CASH") {
            await ledgerService.post(
              undefined,
              {
                eventType: "RUNNER_CASH_PURCHASE",
                sourceType: "RUNNER_PURCHASE",
                sourceId: purchase.id,
                description: `Runner cash purchase for task ${task?.taskNumber ?? purchase.id}`,
                lines: postingRules.RUNNER_CASH_PURCHASE({
                  amountPaisa: payload.amount_paisa,
                  runnerId: actor.id,
                }),
              },
              actor
            );
          } else {
            await ledgerService.post(
              undefined,
              {
                eventType: "SUPPLIER_CREDIT_PURCHASE",
                sourceType: "RUNNER_PURCHASE",
                sourceId: purchase.id,
                description: `Supplier credit purchase for task ${task?.taskNumber ?? purchase.id}`,
                lines: postingRules.SUPPLIER_CREDIT_PURCHASE({
                  amountPaisa: payload.amount_paisa,
                  supplierId: payload.supplier_id,
                }),
              },
              actor
            );
          }

          await emitOutbox(undefined, {
            type: "sourcing.purchase_completed",
            aggregateType: "purchase",
            aggregateId: purchase.id,
            payload: {
              purchaseId: purchase.id,
              taskId: task?.id,
              runnerId: actor.id,
              amountPaisa: payload.amount_paisa,
              requiresApproval,
            },
          });

          results.push({
            client_mutation_id: mutation.client_mutation_id,
            result: "ok",
            server_ids: {
              purchase_id: purchase.id,
              ...(task ? { task_id: task.id } : {}),
            },
            message: "Purchase processed successfully",
          });
          continue;
        }

        if (mutation.type === "TASK_CONTACTED") {
          const taskId = (mutation.payload as { task_id?: string })?.task_id;
          if (!taskId) {
            results.push({
              client_mutation_id: mutation.client_mutation_id,
              result: "error",
              message: "Missing task_id in TASK_CONTACTED payload",
            });
            continue;
          }

          // Check if already contacted
          const events = await sourcingRepo.listRunnerTaskEvents(taskId);
          const alreadyContacted = events.some((e) => e.eventType === "STALL_CONTACTED");
          if (alreadyContacted) {
            results.push({
              client_mutation_id: mutation.client_mutation_id,
              result: "duplicate",
              message: "Task already marked contacted",
            });
            continue;
          }

          await this.markTaskContacted(taskId, actor);
          results.push({
            client_mutation_id: mutation.client_mutation_id,
            result: "ok",
            server_ids: { task_id: taskId },
            message: "Task marked contacted",
          });
          continue;
        }

        if (mutation.type === "OVERRIDE_REQUEST") {
          const taskId = (mutation.payload as { task_id?: string })?.task_id;
          if (!taskId) {
            results.push({
              client_mutation_id: mutation.client_mutation_id,
              result: "error",
              message: "Missing task_id in OVERRIDE_REQUEST payload",
            });
            continue;
          }

          const task = await sourcingRepo.getRunnerTaskById(taskId);
          if (task && task.status === "PRICE_EXCEEDED_PENDING") {
            results.push({
              client_mutation_id: mutation.client_mutation_id,
              result: "duplicate",
              message: "Override request already pending",
            });
            continue;
          }

          const res = await this.requestOverride(
            taskId,
            mutation.payload as RunnerTaskOverrideRequestDto,
            actor
          );
          results.push({
            client_mutation_id: mutation.client_mutation_id,
            result: "ok",
            server_ids: { task_id: taskId },
            message: res.allowed ? "Override allowed within margin" : "Override pending approval",
          });
          continue;
        }

        results.push({
          client_mutation_id: mutation.client_mutation_id,
          result: "error",
          message: `Unknown mutation type: ${(mutation as { type: string }).type}`,
        });
      } catch (err: unknown) {
        results.push({
          client_mutation_id: mutation.client_mutation_id,
          result: "error",
          message: (err as Error).message || "Internal mutation error",
        });
      }
    }

    const response: RunnerSyncResponseDto = { results };
    if (idempotencyKey) {
      memSyncBatchCache.set(idempotencyKey, response);
    }

    return response;
  },

  /**
   * POST /api/v1/runner/tasks/:taskId/sync-purchase
   * Single-task endpoint wrapper over the sync service (X-Client-Mutation-Id header).
   */
  async syncSinglePurchase(
    taskId: string,
    body: SingleTaskSyncPurchaseDto,
    clientMutationId: string,
    actor: Actor
  ): Promise<RunnerSyncItemResult> {
    const batch: RunnerSyncBatchDto = {
      mutations: [
        {
          client_mutation_id: clientMutationId,
          type: "PURCHASE",
          payload: {
            task_id: taskId,
            supplier_id: body.supplier_id,
            sku_id: body.sku_id,
            qty: body.qty,
            unit_cost_paisa: body.unit_cost_paisa,
            amount_paisa: body.amount_paisa,
            payment_mode: body.payment_mode,
            receipt_media_id: body.receipt_media_id ?? null,
            receipt_missing_flag: body.receipt_missing_flag,
          },
          recorded_at: body.recorded_at ?? new Date().toISOString(),
        },
      ],
    };

    const res = await this.syncMutations(batch, actor);
    return res.results[0]!;
  },

  /**
   * POST /api/v1/runner/purchases/:id/receipt-upload-url
   * Presigned PUT URL for receipt photo (≤10MB).
   */
  async getReceiptUploadUrl(
    purchaseId: string,
    dto: ReceiptUploadUrlDto,
    actor: Actor
  ): Promise<{ uploadUrl: string; mediaId: string; storageKey: string }> {
    assertCanRunRunner(actor);

    const purchase = await sourcingRepo.getRunnerPurchaseById(purchaseId);
    if (!purchase) {
      throw new NotFoundError(`Purchase '${purchaseId}' not found`);
    }

    const maxBytes = 10 * 1024 * 1024; // 10MB
    const sizeBytes = dto.size_bytes ?? 1024 * 1024;
    if (sizeBytes > maxBytes) {
      throw new ValidationError("Image size exceeds maximum limit of 10MB");
    }

    const storageKey = `receipts/${purchaseId}-${Date.now()}.jpg`;
    const mediaAsset = await mediaService.createMediaAsset({
      ownerType: "RUNNER_PURCHASE",
      ownerId: purchaseId,
      kind: "RECEIPT_PHOTO",
      bucket: "ncamart-receipts",
      storageKey,
      contentType: dto.content_type ?? "image/jpeg",
      sizeBytes,
      isPublic: false,
      uploadedByType: "STAFF",
      uploadedById: actor.id,
    });

    const uploadUrl = `https://storage.ncamart.com/upload/${mediaAsset.id}?signature=mock_presigned_url`;

    return {
      uploadUrl,
      mediaId: mediaAsset.id,
      storageKey,
    };
  },

  /**
   * POST /api/v1/runner/purchases/:id/receipt-complete
   * Finalizes receipt photo upload and clears the missing flag.
   */
  async completeReceiptUpload(
    purchaseId: string,
    mediaId: string,
    actor: Actor
  ): Promise<RunnerPurchaseRow> {
    assertCanRunRunner(actor);

    const purchase = await sourcingRepo.getRunnerPurchaseById(purchaseId);
    if (!purchase) {
      throw new NotFoundError(`Purchase '${purchaseId}' not found`);
    }

    await mediaService.markMediaReady(mediaId);

    const updated = await sourcingRepo.updateRunnerPurchase(purchaseId, {
      receiptMediaId: mediaId,
      receiptMissingFlag: false,
      requiresApproval: false, // Receipt uploaded -> clears approval requirement
    });

    return updated!;
  },

  /**
   * POST /api/v1/admin/sourcing/purchases/:id/approve
   * SOURCING_MANAGER approves a purchase that exceeded ৳2,000 without receipt.
   */
  async approvePurchase(
    purchaseId: string,
    actor: Actor
  ): Promise<RunnerPurchaseRow> {
    assertCanApprovePurchase(actor);

    const purchase = await sourcingRepo.getRunnerPurchaseById(purchaseId);
    if (!purchase) {
      throw new NotFoundError(`Purchase '${purchaseId}' not found`);
    }

    const updated = await sourcingRepo.updateRunnerPurchase(purchaseId, {
      requiresApproval: false,
      approvedBy: actor.id,
    });

    await emitOutbox(undefined, {
      type: "sourcing.purchase_approved",
      aggregateType: "purchase",
      aggregateId: purchase.id,
      payload: {
        purchaseId: purchase.id,
        approvedBy: actor.id,
      },
    });

    return updated!;
  },

  /**
   * POST /api/v1/admin/godown/receive-runner-items
   * GODOWN_MANAGER or QC_TECHNICIAN receives runner items at godown:
   * -> task RECEIVED_AT_GODOWN
   * -> units into QC_HOLD (RUNNER_RECEIPT movement)
   * -> order advances from SOURCING to AT_GODOWN_QC when all lines received.
   */
  async receiveRunnerItems(
    taskIds: string[],
    actor: Actor
  ): Promise<{ receivedTaskIds: string[]; success: boolean }> {
    assertCanReceiveGodown(actor);

    for (const taskId of taskIds) {
      const task = await sourcingRepo.getRunnerTaskById(taskId);
      if (!task) {
        throw new NotFoundError(`Runner task '${taskId}' not found`);
      }

      // Receive physical units into QC_HOLD with RUNNER_RECEIPT
      await inventoryService.receive(
        undefined,
        {
          skuId: task.skuId,
          locationCode: "QC_HOLD",
          qty: task.qty,
          unitCostPaisa: task.quotedUnitPricePaisa ?? task.maxUnitPricePaisa,
          reason: "RUNNER_RECEIPT",
          refType: "RUNNER_TASK",
          refId: task.id,
        },
        actor
      );

      // Transition task to RECEIVED_AT_GODOWN and advance order if ready
      await this.markTaskReceivedAtGodown(task.id, actor);
    }

    return { receivedTaskIds: taskIds, success: true };
  },

  /**
   * List runner purchases (admin / sourcing).
   */
  async listPurchases(
    filter?: {
      runnerId?: string;
      supplierId?: string;
      taskId?: string;
      syncStatus?: RunnerPurchaseRow["syncStatus"];
      requiresApproval?: boolean;
      page?: number;
      limit?: number;
    },
    actor?: Actor
  ): Promise<{ items: RunnerPurchaseRow[]; total: number }> {
    if (actor) assertCanReadSuppliers(actor);
    return sourcingRepo.listRunnerPurchases(filter);
  },

  async getPurchaseById(
    id: string,
    actor?: Actor
  ): Promise<RunnerPurchaseRow | null> {
    if (actor) assertCanReadSuppliers(actor);
    return sourcingRepo.getRunnerPurchaseById(id);
  },

  clearMemoryForTesting(): void {
    memSyncBatchCache.clear();
    sourcingRepo.clearMemoryForTesting();
  },
};

const memSyncBatchCache = new Map<string, RunnerSyncResponseDto>();

