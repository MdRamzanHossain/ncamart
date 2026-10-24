import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { Tx, db } from "@/lib/db";
import {
  suppliers,
  supplierStock,
  supplierQcBatches,
  runnerTasks,
  runnerTaskEvents,
  runnerFloatSessions,
  runnerPurchases,
  SupplierRow,
  InsertSupplierRow,
  SupplierStockRow,
  InsertSupplierStockRow,
  SupplierQcBatchRow,
  InsertSupplierQcBatchRow,
  RunnerTaskRow,
  InsertRunnerTaskRow,
  RunnerTaskEventRow,
  InsertRunnerTaskEventRow,
  RunnerFloatSessionRow,
  InsertRunnerFloatSessionRow,
  RunnerPurchaseRow,
  InsertRunnerPurchaseRow,
} from "./schema";
import { SupplierFilterDto, RunnerTaskFilterDto } from "./dto";
import { BusinessError } from "@/lib/errors";

// In-Memory Fallback Stores for Offline / Testing Mode
const memSuppliers = new Map<string, SupplierRow>();
const memSupplierStock = new Map<string, SupplierStockRow>(); // Key: `${supplierId}:${skuId}`
const memQcBatches = new Map<string, SupplierQcBatchRow>();
const memTodayConfirmedVirtualOrders = new Map<string, number>(); // Key: skuId, Value: count today
const memTasks = new Map<string, RunnerTaskRow>();
const memTaskEvents: RunnerTaskEventRow[] = [];
const memFloatSessions = new Map<string, RunnerFloatSessionRow>();
const memPurchases = new Map<string, RunnerPurchaseRow>();

export const sourcingRepo = {
  clearMemoryForTesting(): void {
    memSuppliers.clear();
    memSupplierStock.clear();
    memQcBatches.clear();
    memTodayConfirmedVirtualOrders.clear();
    memTasks.clear();
    memTaskEvents.length = 0;
    memFloatSessions.clear();
    memPurchases.clear();
  },


  setTodayVirtualOrderCountForTesting(skuId: string, count: number): void {
    memTodayConfirmedVirtualOrders.set(skuId, count);
  },

  async createSupplier(row: InsertSupplierRow): Promise<SupplierRow> {
    const fullRow: SupplierRow = {
      id: row.id ?? crypto.randomUUID(),
      name: row.name,
      proprietorName: row.proprietorName,
      market: row.market,
      stallNo: row.stallNo,
      floor: row.floor,
      phone: row.phone,
      bkashMerchantNumber: row.bkashMerchantNumber ?? null,
      acceptedPaymentModes: row.acceptedPaymentModes,
      status: row.status ?? "ACTIVE",
      suspendedReason: row.suspendedReason ?? null,
      totalUnitsSourced: row.totalUnitsSourced ?? 0,
      qcFailedUnits: row.qcFailedUnits ?? 0,
      defectRateBp: row.defectRateBp ?? 0,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };

    try {
      const [inserted] = await db.insert(suppliers).values(fullRow).returning();
      if (inserted) return inserted;
    } catch {
      // In-memory fallback
    }

    memSuppliers.set(fullRow.id, fullRow);
    return fullRow;
  },

  async updateSupplier(
    id: string,
    updates: Partial<InsertSupplierRow>
  ): Promise<SupplierRow | null> {
    const existing = await this.getSupplierById(id);
    if (!existing) return null;

    const updated: SupplierRow = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    try {
      const [row] = await db
        .update(suppliers)
        .set(updated)
        .where(eq(suppliers.id, id))
        .returning();
      if (row) return row;
    } catch {
      // In-memory fallback
    }

    memSuppliers.set(id, updated);
    return updated;
  },

  async getSupplierById(id: string): Promise<SupplierRow | null> {
    try {
      const rows = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, id))
        .limit(1);
      if (rows.length > 0) return rows[0] ?? null;
    } catch {
      // In-memory fallback
    }
    return memSuppliers.get(id) ?? null;
  },

  async listSuppliers(
    filter: SupplierFilterDto
  ): Promise<{ items: SupplierRow[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const offset = (page - 1) * limit;

    try {
      const conditions = [];
      if (filter.market) conditions.push(eq(suppliers.market, filter.market));
      if (filter.status) conditions.push(eq(suppliers.status, filter.status));
      if (filter.search) {
        const pattern = `%${filter.search}%`;
        conditions.push(
          or(
            ilike(suppliers.name, pattern),
            ilike(suppliers.proprietorName, pattern),
            ilike(suppliers.phone, pattern),
            ilike(suppliers.stallNo, pattern)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await db
        .select()
        .from(suppliers)
        .where(whereClause)
        .orderBy(desc(suppliers.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(suppliers)
        .where(whereClause);

      const total = Number(countResult[0]?.count ?? 0);
      if (total > 0 || items.length > 0) {
        return { items, total };
      }
    } catch {
      // In-memory fallback
    }

    // In-memory evaluation
    let memList = Array.from(memSuppliers.values());
    if (filter.market) {
      memList = memList.filter((s) => s.market === filter.market);
    }
    if (filter.status) {
      memList = memList.filter((s) => s.status === filter.status);
    }
    if (filter.search) {
      const sLower = filter.search.toLowerCase();
      memList = memList.filter(
        (s) =>
          s.name.toLowerCase().includes(sLower) ||
          s.proprietorName.toLowerCase().includes(sLower) ||
          s.phone.includes(sLower) ||
          s.stallNo.toLowerCase().includes(sLower)
      );
    }

    memList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = memList.length;
    const items = memList.slice(offset, offset + limit);

    return { items, total };
  },

  async upsertSupplierStock(
    rows: InsertSupplierStockRow[]
  ): Promise<SupplierStockRow[]> {
    const results: SupplierStockRow[] = [];

    for (const r of rows) {
      const row: SupplierStockRow = {
        supplierId: r.supplierId,
        skuId: r.skuId,
        status: r.status ?? "AVAILABLE",
        dailyOrderCap: r.dailyOrderCap ?? null,
        lastQuotedCostPaisa: r.lastQuotedCostPaisa ?? null,
        priority: r.priority ?? 1,
        confirmedAt: r.confirmedAt ?? new Date(),
        confirmedBy: r.confirmedBy ?? null,
      };

      try {
        await db
          .insert(supplierStock)
          .values(row)
          .onConflictDoUpdate({
            target: [supplierStock.supplierId, supplierStock.skuId],
            set: {
              status: row.status,
              dailyOrderCap: row.dailyOrderCap,
              lastQuotedCostPaisa: row.lastQuotedCostPaisa,
              priority: row.priority,
              confirmedAt: row.confirmedAt,
              confirmedBy: row.confirmedBy,
            },
          });
      } catch {
        // Fallback
      }

      const key = `${row.supplierId}:${row.skuId}`;
      memSupplierStock.set(key, row);
      results.push(row);
    }

    return results;
  },

  async getSupplierStock(
    supplierId: string,
    skuId: string
  ): Promise<SupplierStockRow | null> {
    try {
      const rows = await db
        .select()
        .from(supplierStock)
        .where(
          and(
            eq(supplierStock.supplierId, supplierId),
            eq(supplierStock.skuId, skuId)
          )
        )
        .limit(1);
      if (rows.length > 0) return rows[0] ?? null;
    } catch {
      // In-memory fallback
    }
    const key = `${supplierId}:${skuId}`;
    return memSupplierStock.get(key) ?? null;
  },

  async listSupplierStocksForSku(
    skuId: string
  ): Promise<Array<SupplierStockRow & { supplier: SupplierRow }>> {
    try {
      const rows = await db
        .select({
          stock: supplierStock,
          supplier: suppliers,
        })
        .from(supplierStock)
        .innerJoin(suppliers, eq(supplierStock.supplierId, suppliers.id))
        .where(eq(supplierStock.skuId, skuId));

      if (rows.length > 0) {
        return rows.map((r) => ({
          ...r.stock,
          supplier: r.supplier,
        }));
      }
    } catch {
      // In-memory fallback
    }

    const matches: Array<SupplierStockRow & { supplier: SupplierRow }> = [];
    for (const stock of memSupplierStock.values()) {
      if (stock.skuId === skuId) {
        const supplier = memSuppliers.get(stock.supplierId);
        if (supplier) {
          matches.push({
            ...stock,
            supplier,
          });
        }
      }
    }
    return matches;
  },

  async createQcBatch(row: InsertSupplierQcBatchRow): Promise<SupplierQcBatchRow> {
    const fullRow: SupplierQcBatchRow = {
      id: row.id ?? crypto.randomUUID(),
      supplierId: row.supplierId,
      runnerTaskId: row.runnerTaskId ?? null,
      unitsTotal: row.unitsTotal,
      unitsFailed: row.unitsFailed,
      outcome: row.outcome,
      createdAt: row.createdAt ?? new Date(),
    };

    try {
      const [inserted] = await db
        .insert(supplierQcBatches)
        .values(fullRow)
        .returning();
      if (inserted) return inserted;
    } catch {
      // In-memory fallback
    }

    memQcBatches.set(fullRow.id, fullRow);
    return fullRow;
  },

  async listStaleSupplierStock(cutoffDate: Date): Promise<SupplierStockRow[]> {
    try {
      const rows = await db
        .select()
        .from(supplierStock)
        .where(
          and(
            eq(supplierStock.status, "AVAILABLE"),
            sql`${supplierStock.confirmedAt} < ${cutoffDate}`
          )
        );
      if (rows.length > 0) return rows;
    } catch {
      // In-memory fallback
    }

    const staleList: SupplierStockRow[] = [];
    for (const stock of memSupplierStock.values()) {
      if (stock.status === "AVAILABLE" && stock.confirmedAt < cutoffDate) {
        staleList.push(stock);
      }
    }
    return staleList;
  },

  async getTodayConfirmedVirtualOrdersCount(skuId: string): Promise<number> {
    return memTodayConfirmedVirtualOrders.get(skuId) ?? 0;
  },

  async incrementTodayConfirmedVirtualOrdersCount(
    skuId: string,
    qty: number = 1
  ): Promise<void> {
    const current = memTodayConfirmedVirtualOrders.get(skuId) ?? 0;
    memTodayConfirmedVirtualOrders.set(skuId, current + qty);
  },

  // --------------------------------------------------------------------------
  // Runner Tasks
  // --------------------------------------------------------------------------
  async createRunnerTask(
    task: InsertRunnerTaskRow,
    tx?: Tx
  ): Promise<RunnerTaskRow> {
    const client = tx ?? db;
    const id = task.id ?? crypto.randomUUID();
    const fullRow: RunnerTaskRow = {
      id,
      taskNumber: task.taskNumber,
      taskType: task.taskType,
      orderId: task.orderId ?? null,
      orderItemId: task.orderItemId ?? null,
      skuId: task.skuId,
      qty: task.qty,
      supplierId: task.supplierId,
      backupSupplierId: task.backupSupplierId ?? null,
      maxUnitPricePaisa: task.maxUnitPricePaisa,
      runnerId: task.runnerId ?? null,
      status: task.status ?? "PENDING_ASSIGNMENT",
      quotedUnitPricePaisa: task.quotedUnitPricePaisa ?? null,
      overrideReason: task.overrideReason ?? null,
      overrideDecidedBy: task.overrideDecidedBy ?? null,
      overrideDecision: task.overrideDecision ?? null,
      dueAt: task.dueAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000),
      acknowledgedAt: task.acknowledgedAt ?? null,
      escalatedAt: task.escalatedAt ?? null,
      createdAt: task.createdAt ?? new Date(),
      updatedAt: task.updatedAt ?? new Date(),
    };

    try {
      const [inserted] = await client.insert(runnerTasks).values(fullRow).returning();
      if (inserted) {
        memTasks.set(id, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memTasks.set(id, fullRow);
    return fullRow;
  },

  async updateRunnerTask(
    id: string,
    updates: Partial<InsertRunnerTaskRow>,
    tx?: Tx
  ): Promise<RunnerTaskRow | null> {
    const client = tx ?? db;
    const existing = await this.getRunnerTaskById(id, tx);
    if (!existing) return null;

    const updated: RunnerTaskRow = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    try {
      const [row] = await client
        .update(runnerTasks)
        .set(updated)
        .where(eq(runnerTasks.id, id))
        .returning();
      if (row) {
        memTasks.set(id, row);
        return row;
      }
    } catch {
      // Memory fallback
    }

    memTasks.set(id, updated);
    return updated;
  },

  async getRunnerTaskById(id: string, tx?: Tx): Promise<RunnerTaskRow | null> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(runnerTasks)
        .where(eq(runnerTasks.id, id))
        .limit(1);
      if (rows.length > 0 && rows[0]) return rows[0];
    } catch {
      // Memory fallback
    }
    return memTasks.get(id) ?? null;
  },

  async getRunnerTaskByNumber(taskNumber: string, tx?: Tx): Promise<RunnerTaskRow | null> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(runnerTasks)
        .where(eq(runnerTasks.taskNumber, taskNumber))
        .limit(1);
      if (rows.length > 0 && rows[0]) return rows[0];
    } catch {
      // Memory fallback
    }
    for (const t of memTasks.values()) {
      if (t.taskNumber === taskNumber) return t;
    }
    return null;
  },

  async listRunnerTasks(
    filter?: RunnerTaskFilterDto,
    tx?: Tx
  ): Promise<{ items: RunnerTaskRow[]; total: number }> {
    const client = tx ?? db;
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const offset = (page - 1) * limit;

    try {
      const conditions = [];
      if (filter?.status) conditions.push(eq(runnerTasks.status, filter.status));
      if (filter?.taskType) conditions.push(eq(runnerTasks.taskType, filter.taskType));
      if (filter?.runnerId) conditions.push(eq(runnerTasks.runnerId, filter.runnerId));
      if (filter?.orderId) conditions.push(eq(runnerTasks.orderId, filter.orderId));
      if (filter?.skuId) conditions.push(eq(runnerTasks.skuId, filter.skuId));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await client
        .select()
        .from(runnerTasks)
        .where(whereClause)
        .orderBy(desc(runnerTasks.createdAt))
        .limit(limit)
        .offset(offset);

      const countRes = await client
        .select({ count: sql<number>`count(*)` })
        .from(runnerTasks)
        .where(whereClause);
      const total = Number(countRes[0]?.count ?? 0);

      if (rows.length > 0 || total > 0) {
        return { items: rows, total };
      }
    } catch {
      // Memory fallback
    }

    let all = Array.from(memTasks.values());
    if (filter?.status) all = all.filter((t) => t.status === filter.status);
    if (filter?.taskType) all = all.filter((t) => t.taskType === filter.taskType);
    if (filter?.runnerId) all = all.filter((t) => t.runnerId === filter.runnerId);
    if (filter?.orderId) all = all.filter((t) => t.orderId === filter.orderId);
    if (filter?.skuId) all = all.filter((t) => t.skuId === filter.skuId);

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const items = all.slice(offset, offset + limit);
    return { items, total };
  },

  async countOpenTasksForRunner(runnerId: string, tx?: Tx): Promise<number> {
    const openStatuses: RunnerTaskRow["status"][] = [
      "DISPATCHED",
      "STALL_CONTACTED",
      "PRICE_EXCEEDED_PENDING",
    ];

    const client = tx ?? db;
    try {
      const countRes = await client
        .select({ count: sql<number>`count(*)` })
        .from(runnerTasks)
        .where(
          and(
            eq(runnerTasks.runnerId, runnerId),
            sql`${runnerTasks.status} IN ('DISPATCHED', 'STALL_CONTACTED', 'PRICE_EXCEEDED_PENDING')`
          )
        );
      return Number(countRes[0]?.count ?? 0);
    } catch {
      // Memory fallback
    }

    let count = 0;
    for (const t of memTasks.values()) {
      if (t.runnerId === runnerId && openStatuses.includes(t.status)) {
        count++;
      }
    }
    return count;
  },

  // --------------------------------------------------------------------------
  // Runner Task Events (Append-only)
  // --------------------------------------------------------------------------
  async createRunnerTaskEvent(
    event: InsertRunnerTaskEventRow,
    tx?: Tx
  ): Promise<RunnerTaskEventRow> {
    const client = tx ?? db;
    const id = event.id ?? crypto.randomUUID();
    const fullRow: RunnerTaskEventRow = {
      id,
      taskId: event.taskId,
      eventType: event.eventType,
      actorType: event.actorType,
      actorId: event.actorId ?? null,
      payload: event.payload ?? null,
      createdAt: event.createdAt ?? new Date(),
    };

    try {
      const [inserted] = await client.insert(runnerTaskEvents).values(fullRow).returning();
      if (inserted) {
        memTaskEvents.push(inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memTaskEvents.push(fullRow);
    return fullRow;
  },

  async listRunnerTaskEvents(taskId: string, tx?: Tx): Promise<RunnerTaskEventRow[]> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(runnerTaskEvents)
        .where(eq(runnerTaskEvents.taskId, taskId))
        .orderBy(runnerTaskEvents.createdAt);
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    return memTaskEvents
      .filter((e) => e.taskId === taskId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  // --------------------------------------------------------------------------
  // Runner Float Sessions (P24 Shift Status & P25 Sessions)
  // --------------------------------------------------------------------------
  async createFloatSession(
    session: InsertRunnerFloatSessionRow,
    tx?: Tx
  ): Promise<RunnerFloatSessionRow> {
    const client = tx ?? db;
    // Check partial unique index constraint (only one OPEN session per runner)
    const status = session.status ?? "OPEN";
    if (status === "OPEN") {
      const active = await this.getActiveFloatSessionForRunner(session.runnerId, tx);
      if (active) {
        throw new BusinessError(
          "ERR_FLOAT_SESSION_ALREADY_OPEN",
          `Runner '${session.runnerId}' already has an active OPEN float session`,
          { existingSessionId: active.id },
          409
        );
      }
    }

    const id = session.id ?? crypto.randomUUID();
    const fullRow: RunnerFloatSessionRow = {
      id,
      runnerId: session.runnerId,
      issuedPaisa: session.issuedPaisa ?? 0,
      purchasesCashPaisa: session.purchasesCashPaisa ?? 0,
      supplierRefundsPaisa: session.supplierRefundsPaisa ?? 0,
      returnedPaisa: session.returnedPaisa ?? null,
      variancePaisa: session.variancePaisa ?? null,
      status,
      openedBy: session.openedBy,
      openedAt: session.openedAt ?? new Date(),
      countedBy: session.countedBy ?? null,
      countedAt: session.countedAt ?? null,
      closedAt: session.closedAt ?? null,
      varianceReason: session.varianceReason ?? null,
      smSignoffBy: session.smSignoffBy ?? null,
      foSignoffBy: session.foSignoffBy ?? null,
      createdAt: session.createdAt ?? new Date(),
      updatedAt: session.updatedAt ?? new Date(),
    };

    try {
      const [inserted] = await client.insert(runnerFloatSessions).values(fullRow).returning();
      if (inserted) {
        memFloatSessions.set(id, inserted);
        return inserted;
      }
    } catch (err: unknown) {
      if (err instanceof BusinessError) throw err;
      // Memory fallback
    }

    memFloatSessions.set(id, fullRow);
    return fullRow;
  },

  async getFloatSessionById(
    id: string,
    tx?: Tx
  ): Promise<RunnerFloatSessionRow | null> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(runnerFloatSessions)
        .where(eq(runnerFloatSessions.id, id))
        .limit(1);
      if (rows.length > 0 && rows[0]) return rows[0];
    } catch {
      // Memory fallback
    }

    return memFloatSessions.get(id) ?? null;
  },

  async updateFloatSession(
    id: string,
    updates: Partial<InsertRunnerFloatSessionRow>,
    tx?: Tx
  ): Promise<RunnerFloatSessionRow | null> {
    const existing = await this.getFloatSessionById(id, tx);
    if (!existing) return null;

    const client = tx ?? db;
    const updated: RunnerFloatSessionRow = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    try {
      const [row] = await client
        .update(runnerFloatSessions)
        .set(updated)
        .where(eq(runnerFloatSessions.id, id))
        .returning();
      if (row) {
        memFloatSessions.set(id, row);
        return row;
      }
    } catch {
      // Memory fallback
    }

    memFloatSessions.set(id, updated);
    return updated;
  },

  async getActiveFloatSessionForRunner(
    runnerId: string,
    tx?: Tx
  ): Promise<RunnerFloatSessionRow | null> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(runnerFloatSessions)
        .where(
          and(
            eq(runnerFloatSessions.runnerId, runnerId),
            eq(runnerFloatSessions.status, "OPEN")
          )
        )
        .limit(1);
      if (rows.length > 0 && rows[0]) return rows[0];
    } catch {
      // Memory fallback
    }

    for (const s of memFloatSessions.values()) {
      if (s.runnerId === runnerId && s.status === "OPEN") {
        return s;
      }
    }
    return null;
  },

  async listOpenFloatSessions(tx?: Tx): Promise<RunnerFloatSessionRow[]> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(runnerFloatSessions)
        .where(eq(runnerFloatSessions.status, "OPEN"));
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    return Array.from(memFloatSessions.values()).filter((s) => s.status === "OPEN");
  },

  async listFloatSessions(
    filter?: {
      status?: RunnerFloatSessionRow["status"];
      runnerId?: string;
      from?: Date;
      to?: Date;
      page?: number;
      limit?: number;
    },
    tx?: Tx
  ): Promise<{ items: RunnerFloatSessionRow[]; total: number }> {
    const client = tx ?? db;
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 20;
    const offset = (page - 1) * limit;

    try {
      const conditions = [];
      if (filter?.status) conditions.push(eq(runnerFloatSessions.status, filter.status));
      if (filter?.runnerId) conditions.push(eq(runnerFloatSessions.runnerId, filter.runnerId));
      if (filter?.from) conditions.push(sql`${runnerFloatSessions.createdAt} >= ${filter.from}`);
      if (filter?.to) conditions.push(sql`${runnerFloatSessions.createdAt} <= ${filter.to}`);

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await client
        .select()
        .from(runnerFloatSessions)
        .where(whereClause)
        .orderBy(desc(runnerFloatSessions.createdAt))
        .limit(limit)
        .offset(offset);

      const countRes = await client
        .select({ count: sql<number>`count(*)` })
        .from(runnerFloatSessions)
        .where(whereClause);
      const total = Number(countRes[0]?.count ?? 0);

      if (rows.length > 0 || total > 0) {
        return { items: rows, total };
      }
    } catch {
      // Memory fallback
    }

    let all = Array.from(memFloatSessions.values());
    if (filter?.status) all = all.filter((s) => s.status === filter.status);
    if (filter?.runnerId) all = all.filter((s) => s.runnerId === filter.runnerId);
    if (filter?.from) all = all.filter((s) => s.createdAt >= filter.from!);
    if (filter?.to) all = all.filter((s) => s.createdAt <= filter.to!);

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const items = all.slice(offset, offset + limit);
    return { items, total };
  },

  async getFloatVarianceReport(
    tx?: Tx
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
    const { items: all } = await this.listFloatSessions({ limit: 10000 }, tx);
    const map = new Map<
      string,
      {
        runnerId: string;
        totalSessions: number;
        totalIssuedPaisa: number;
        totalPurchasesCashPaisa: number;
        totalSupplierRefundsPaisa: number;
        totalReturnedPaisa: number;
        totalVariancePaisa: number;
        sessionsWithVariance: number;
      }
    >();

    for (const s of all) {
      let stat = map.get(s.runnerId);
      if (!stat) {
        stat = {
          runnerId: s.runnerId,
          totalSessions: 0,
          totalIssuedPaisa: 0,
          totalPurchasesCashPaisa: 0,
          totalSupplierRefundsPaisa: 0,
          totalReturnedPaisa: 0,
          totalVariancePaisa: 0,
          sessionsWithVariance: 0,
        };
        map.set(s.runnerId, stat);
      }

      stat.totalSessions++;
      stat.totalIssuedPaisa += s.issuedPaisa;
      stat.totalPurchasesCashPaisa += s.purchasesCashPaisa;
      stat.totalSupplierRefundsPaisa += s.supplierRefundsPaisa;
      stat.totalReturnedPaisa += s.returnedPaisa ?? 0;
      stat.totalVariancePaisa += s.variancePaisa ?? 0;
      if (s.variancePaisa && s.variancePaisa !== 0) {
        stat.sessionsWithVariance++;
      }
    }

    return Array.from(map.values());
  },

  // --------------------------------------------------------------------------
  // Runner Purchases (P25 Purchases & Sync)
  // --------------------------------------------------------------------------
  async createRunnerPurchase(
    purchase: InsertRunnerPurchaseRow,
    tx?: Tx
  ): Promise<RunnerPurchaseRow> {
    const client = tx ?? db;
    const id = purchase.id ?? crypto.randomUUID();
    const fullRow: RunnerPurchaseRow = {
      id,
      clientMutationId: purchase.clientMutationId,
      taskId: purchase.taskId ?? null,
      floatSessionId: purchase.floatSessionId ?? null,
      runnerId: purchase.runnerId,
      supplierId: purchase.supplierId,
      skuId: purchase.skuId,
      qty: purchase.qty,
      unitCostPaisa: purchase.unitCostPaisa,
      amountPaisa: purchase.amountPaisa,
      paymentMode: purchase.paymentMode,
      receiptMediaId: purchase.receiptMediaId ?? null,
      receiptMissingFlag: purchase.receiptMissingFlag ?? false,
      requiresApproval: purchase.requiresApproval ?? false,
      approvedBy: purchase.approvedBy ?? null,
      syncStatus: purchase.syncStatus,
      recordedAt: purchase.recordedAt ?? new Date(),
      receivedAt: purchase.receivedAt ?? new Date(),
      createdAt: purchase.createdAt ?? new Date(),
    };

    try {
      const [inserted] = await client.insert(runnerPurchases).values(fullRow).returning();
      if (inserted) {
        memPurchases.set(id, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memPurchases.set(id, fullRow);
    return fullRow;
  },

  async getRunnerPurchaseById(
    id: string,
    tx?: Tx
  ): Promise<RunnerPurchaseRow | null> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(runnerPurchases)
        .where(eq(runnerPurchases.id, id))
        .limit(1);
      if (rows.length > 0 && rows[0]) return rows[0];
    } catch {
      // Memory fallback
    }

    return memPurchases.get(id) ?? null;
  },

  async getRunnerPurchaseByClientMutationId(
    clientMutationId: string,
    tx?: Tx
  ): Promise<RunnerPurchaseRow | null> {
    const client = tx ?? db;
    try {
      const rows = await client
        .select()
        .from(runnerPurchases)
        .where(eq(runnerPurchases.clientMutationId, clientMutationId))
        .limit(1);
      if (rows.length > 0 && rows[0]) return rows[0];
    } catch {
      // Memory fallback
    }

    for (const p of memPurchases.values()) {
      if (p.clientMutationId === clientMutationId) {
        return p;
      }
    }
    return null;
  },

  async updateRunnerPurchase(
    id: string,
    updates: Partial<InsertRunnerPurchaseRow>,
    tx?: Tx
  ): Promise<RunnerPurchaseRow | null> {
    const existing = await this.getRunnerPurchaseById(id, tx);
    if (!existing) return null;

    const client = tx ?? db;
    const updated: RunnerPurchaseRow = {
      ...existing,
      ...updates,
    };

    try {
      const [row] = await client
        .update(runnerPurchases)
        .set(updated)
        .where(eq(runnerPurchases.id, id))
        .returning();
      if (row) {
        memPurchases.set(id, row);
        return row;
      }
    } catch {
      // Memory fallback
    }

    memPurchases.set(id, updated);
    return updated;
  },

  async listRunnerPurchases(
    filter?: {
      runnerId?: string;
      supplierId?: string;
      taskId?: string;
      syncStatus?: RunnerPurchaseRow["syncStatus"];
      requiresApproval?: boolean;
      page?: number;
      limit?: number;
    },
    tx?: Tx
  ): Promise<{ items: RunnerPurchaseRow[]; total: number }> {
    const client = tx ?? db;
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const offset = (page - 1) * limit;

    try {
      const conditions = [];
      if (filter?.runnerId) conditions.push(eq(runnerPurchases.runnerId, filter.runnerId));
      if (filter?.supplierId) conditions.push(eq(runnerPurchases.supplierId, filter.supplierId));
      if (filter?.taskId) conditions.push(eq(runnerPurchases.taskId, filter.taskId));
      if (filter?.syncStatus) conditions.push(eq(runnerPurchases.syncStatus, filter.syncStatus));
      if (filter?.requiresApproval !== undefined) {
        conditions.push(eq(runnerPurchases.requiresApproval, filter.requiresApproval));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await client
        .select()
        .from(runnerPurchases)
        .where(whereClause)
        .orderBy(desc(runnerPurchases.createdAt))
        .limit(limit)
        .offset(offset);

      const countRes = await client
        .select({ count: sql<number>`count(*)` })
        .from(runnerPurchases)
        .where(whereClause);
      const total = Number(countRes[0]?.count ?? 0);

      if (rows.length > 0 || total > 0) {
        return { items: rows, total };
      }
    } catch {
      // Memory fallback
    }

    let all = Array.from(memPurchases.values());
    if (filter?.runnerId) all = all.filter((p) => p.runnerId === filter.runnerId);
    if (filter?.supplierId) all = all.filter((p) => p.supplierId === filter.supplierId);
    if (filter?.taskId) all = all.filter((p) => p.taskId === filter.taskId);
    if (filter?.syncStatus) all = all.filter((p) => p.syncStatus === filter.syncStatus);
    if (filter?.requiresApproval !== undefined) {
      all = all.filter((p) => p.requiresApproval === filter.requiresApproval);
    }

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const items = all.slice(offset, offset + limit);
    return { items, total };
  },
};


