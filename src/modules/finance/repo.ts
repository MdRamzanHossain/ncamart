import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import {
  invoices,
  InvoiceRow,
  InsertInvoiceRow,
  InvoiceType,
  courierSettlements,
  courierSettlementLines,
  settlementExceptions,
  gatewaySettlements,
  gatewaySettlementLines,
  CourierSettlementRow,
  InsertCourierSettlementRow,
  CourierSettlementLineRow,
  InsertCourierSettlementLineRow,
  SettlementExceptionRow,
  InsertSettlementExceptionRow,
  GatewaySettlementRow,
  InsertGatewaySettlementRow,
  GatewaySettlementLineRow,
  InsertGatewaySettlementLineRow,
  SettlementExceptionKind,
  SettlementExceptionStatus,
} from "./schema";
import { ListExceptionsQuery } from "./dto";

// In-Memory Fallback Stores for test isolation and offline dev
const memInvoices = new Map<string, InvoiceRow>();
const memCourierSettlements = new Map<string, CourierSettlementRow>();
const memCourierSettlementLines = new Map<string, CourierSettlementLineRow>();
const memExceptions = new Map<string, SettlementExceptionRow>();
const memGatewaySettlements = new Map<string, GatewaySettlementRow>();
const memGatewaySettlementLines = new Map<string, GatewaySettlementLineRow>();

export function clearMemoryFinanceForTesting(): void {
  memInvoices.clear();
  memCourierSettlements.clear();
  memCourierSettlementLines.clear();
  memExceptions.clear();
  memGatewaySettlements.clear();
  memGatewaySettlementLines.clear();
}

export const financeRepo = {
  clearMemoryForTesting(): void {
    clearMemoryFinanceForTesting();
  },

  // --------------------------------------------------------------------------
  // Invoices
  // --------------------------------------------------------------------------
  async createInvoice(
    tx: Tx | undefined,
    data: InsertInvoiceRow
  ): Promise<InvoiceRow> {
    const client = tx ?? defaultDb;
    try {
      const [created] = await client.insert(invoices).values(data).returning();
      if (created) return created;
    } catch {
      // Memory Fallback
    }

    const row: InvoiceRow = {
      ...data,
      id: data.id ?? `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      mushakSerial: data.mushakSerial ?? null,
      buyerBin: data.buyerBin ?? null,
      pdfMediaId: data.pdfMediaId ?? null,
      issuedAt: data.issuedAt ?? new Date(),
      createdAt: data.createdAt ?? new Date(),
    };
    memInvoices.set(row.id, row);
    return row;
  },

  async getInvoiceById(
    tx: Tx | undefined,
    id: string
  ): Promise<InvoiceRow | null> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Fallback
    }
    return memInvoices.get(id) ?? null;
  },

  async getInvoiceByNo(
    tx: Tx | undefined,
    invoiceNo: string
  ): Promise<InvoiceRow | null> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(invoices)
        .where(eq(invoices.invoiceNo, invoiceNo))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Fallback
    }
    for (const inv of memInvoices.values()) {
      if (inv.invoiceNo === invoiceNo) return inv;
    }
    return null;
  },

  async getInvoicesByOrderId(
    tx: Tx | undefined,
    orderId: string
  ): Promise<InvoiceRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(invoices)
        .where(eq(invoices.orderId, orderId));
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return Array.from(memInvoices.values()).filter((inv) => inv.orderId === orderId);
  },

  async getInvoiceByOrderAndType(
    tx: Tx | undefined,
    orderId: string,
    type: InvoiceType
  ): Promise<InvoiceRow | null> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(invoices)
        .where(and(eq(invoices.orderId, orderId), eq(invoices.type, type)))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Fallback
    }
    for (const inv of memInvoices.values()) {
      if (inv.orderId === orderId && inv.type === type) return inv;
    }
    return null;
  },

  async updateInvoicePdfMediaId(
    tx: Tx | undefined,
    id: string,
    pdfMediaId: string
  ): Promise<InvoiceRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(invoices)
        .set({ pdfMediaId })
        .where(eq(invoices.id, id))
        .returning();
      if (updated) return updated;
    } catch {
      // Fallback
    }
    const mem = memInvoices.get(id);
    if (mem) {
      mem.pdfMediaId = pdfMediaId;
      return mem;
    }
    return null;
  },

  // --------------------------------------------------------------------------
  // Courier Settlements & Lines (P34)
  // --------------------------------------------------------------------------
  async createCourierSettlement(
    tx: Tx | undefined,
    data: InsertCourierSettlementRow
  ): Promise<CourierSettlementRow> {
    const client = tx ?? defaultDb;
    const id = data.id || crypto.randomUUID();
    const row: CourierSettlementRow = {
      ...data,
      id,
      fileMediaId: data.fileMediaId ?? null,
      status: data.status ?? "IMPORTED",
      createdAt: data.createdAt ?? new Date(),
    };

    try {
      const [created] = await client.insert(courierSettlements).values(row).returning();
      if (created) {
        memCourierSettlements.set(id, created);
        return created;
      }
    } catch {
      // Memory Fallback
    }

    memCourierSettlements.set(id, row);
    return row;
  },

  async getCourierSettlementById(
    tx: Tx | undefined,
    id: string
  ): Promise<CourierSettlementRow | null> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(courierSettlements)
        .where(eq(courierSettlements.id, id))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Fallback
    }
    return memCourierSettlements.get(id) ?? null;
  },

  async getCourierSettlementByCourierAndPayoutRef(
    tx: Tx | undefined,
    courier: string,
    payoutRef: string
  ): Promise<CourierSettlementRow | null> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(courierSettlements)
        .where(
          and(
            eq(courierSettlements.courier, courier as any),
            eq(courierSettlements.payoutRef, payoutRef)
          )
        )
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Fallback
    }
    for (const s of memCourierSettlements.values()) {
      if (s.courier.toLowerCase() === courier.toLowerCase() && s.payoutRef === payoutRef) {
        return s;
      }
    }
    return null;
  },

  async updateCourierSettlement(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertCourierSettlementRow>
  ): Promise<CourierSettlementRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(courierSettlements)
        .set(updates)
        .where(eq(courierSettlements.id, id))
        .returning();
      if (updated) {
        memCourierSettlements.set(id, updated);
        return updated;
      }
    } catch {
      // Fallback
    }
    const existing = memCourierSettlements.get(id);
    if (!existing) {
      throw new Error(`Settlement '${id}' not found`);
    }
    const merged: CourierSettlementRow = {
      ...existing,
      ...updates,
    };
    memCourierSettlements.set(id, merged);
    return merged;
  },

  async createCourierSettlementLines(
    tx: Tx | undefined,
    lines: InsertCourierSettlementLineRow[]
  ): Promise<CourierSettlementLineRow[]> {
    if (lines.length === 0) return [];
    const client = tx ?? defaultDb;
    const rowsToInsert = lines.map((l) => ({
      ...l,
      id: l.id || crypto.randomUUID(),
      shipmentId: l.shipmentId ?? null,
      deliveryChargePaisa: l.deliveryChargePaisa ?? 0,
      codChargePaisa: l.codChargePaisa ?? 0,
      returnChargePaisa: l.returnChargePaisa ?? 0,
      matchStatus: l.matchStatus ?? "PENDING",
      variancePaisa: l.variancePaisa ?? 0,
      resolutionNotes: l.resolutionNotes ?? null,
      resolvedBy: l.resolvedBy ?? null,
      createdAt: l.createdAt ?? new Date(),
    }));

    try {
      const created = await client.insert(courierSettlementLines).values(rowsToInsert).returning();
      if (created.length > 0) {
        for (const row of created) {
          memCourierSettlementLines.set(row.id, row);
        }
        return created;
      }
    } catch {
      // Fallback
    }

    for (const row of rowsToInsert) {
      memCourierSettlementLines.set(row.id, row as CourierSettlementLineRow);
    }
    return rowsToInsert as CourierSettlementLineRow[];
  },

  async getLinesBySettlementId(
    tx: Tx | undefined,
    settlementId: string
  ): Promise<CourierSettlementLineRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(courierSettlementLines)
        .where(eq(courierSettlementLines.settlementId, settlementId));
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return Array.from(memCourierSettlementLines.values()).filter(
      (l) => l.settlementId === settlementId
    );
  },

  async updateCourierSettlementLine(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertCourierSettlementLineRow>
  ): Promise<CourierSettlementLineRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(courierSettlementLines)
        .set(updates)
        .where(eq(courierSettlementLines.id, id))
        .returning();
      if (updated) {
        memCourierSettlementLines.set(id, updated);
        return updated;
      }
    } catch {
      // Fallback
    }
    const existing = memCourierSettlementLines.get(id);
    if (!existing) {
      throw new Error(`Settlement line '${id}' not found`);
    }
    const merged: CourierSettlementLineRow = {
      ...existing,
      ...updates,
    };
    memCourierSettlementLines.set(id, merged);
    return merged;
  },

  // --------------------------------------------------------------------------
  // Settlement Exceptions (P34)
  // --------------------------------------------------------------------------
  async createException(
    tx: Tx | undefined,
    data: InsertSettlementExceptionRow
  ): Promise<SettlementExceptionRow> {
    const client = tx ?? defaultDb;
    const id = data.id || crypto.randomUUID();
    const now = new Date();
    const row: SettlementExceptionRow = {
      ...data,
      id,
      status: data.status ?? "OPEN",
      ageDays: data.ageDays ?? 0,
      notes: data.notes ?? null,
      resolution: data.resolution ?? null,
      resolvedBy: data.resolvedBy ?? null,
      resolvedAt: data.resolvedAt ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };

    try {
      const [created] = await client.insert(settlementExceptions).values(row).returning();
      if (created) {
        memExceptions.set(id, created);
        return created;
      }
    } catch {
      // Fallback
    }
    memExceptions.set(id, row);
    return row;
  },

  async getExceptionById(
    tx: Tx | undefined,
    id: string
  ): Promise<SettlementExceptionRow | null> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(settlementExceptions)
        .where(eq(settlementExceptions.id, id))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Fallback
    }
    return memExceptions.get(id) ?? null;
  },

  async updateException(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertSettlementExceptionRow>
  ): Promise<SettlementExceptionRow> {
    const client = tx ?? defaultDb;
    const payload = { ...updates, updatedAt: new Date() };
    try {
      const [updated] = await client
        .update(settlementExceptions)
        .set(payload)
        .where(eq(settlementExceptions.id, id))
        .returning();
      if (updated) {
        memExceptions.set(id, updated);
        return updated;
      }
    } catch {
      // Fallback
    }
    const existing = memExceptions.get(id);
    if (!existing) {
      throw new Error(`Exception '${id}' not found`);
    }
    const merged: SettlementExceptionRow = {
      ...existing,
      ...payload,
    };
    memExceptions.set(id, merged);
    return merged;
  },

  async listExceptions(
    tx: Tx | undefined,
    filter: ListExceptionsQuery = { limit: 50, offset: 0 }
  ): Promise<{ items: SettlementExceptionRow[]; total: number }> {
    const client = tx ?? defaultDb;
    try {
      const conditions = [];
      if (filter.status) {
        conditions.push(eq(settlementExceptions.status, filter.status));
      }
      if (filter.kind) {
        conditions.push(eq(settlementExceptions.kind, filter.kind));
      }
      if (filter.older_than_days !== undefined) {
        conditions.push(gte(settlementExceptions.ageDays, filter.older_than_days));
      }

      const rows = await client
        .select()
        .from(settlementExceptions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(settlementExceptions.createdAt))
        .limit(filter.limit)
        .offset(filter.offset);

      if (rows.length > 0) {
        return { items: rows, total: rows.length };
      }
    } catch {
      // Fallback
    }

    let all = Array.from(memExceptions.values());
    if (filter.status) {
      all = all.filter((e) => e.status === filter.status);
    }
    if (filter.kind) {
      all = all.filter((e) => e.kind === filter.kind);
    }
    if (filter.older_than_days !== undefined) {
      all = all.filter((e) => e.ageDays >= (filter.older_than_days ?? 0));
    }
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const paginated = all.slice(filter.offset, filter.offset + filter.limit);
    return { items: paginated, total };
  },

  async countOpenExceptionsByKind(tx?: Tx): Promise<{
    SHORT_PAID: number;
    OVER_PAID: number;
    MISSING: number;
    UNKNOWN_CONSIGNMENT: number;
    GATEWAY_UNMATCHED: number;
    total: number;
  }> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select({
          kind: settlementExceptions.kind,
          count: sql<number>`count(*)::int`,
        })
        .from(settlementExceptions)
        .where(eq(settlementExceptions.status, "OPEN"))
        .groupBy(settlementExceptions.kind);

      if (rows.length > 0) {
        const counts = {
          SHORT_PAID: 0,
          OVER_PAID: 0,
          MISSING: 0,
          UNKNOWN_CONSIGNMENT: 0,
          GATEWAY_UNMATCHED: 0,
          total: 0,
        };
        for (const r of rows) {
          const k = r.kind as SettlementExceptionKind;
          if (counts[k] !== undefined) {
            counts[k] = r.count;
            counts.total += r.count;
          }
        }
        return counts;
      }
    } catch {
      // Fallback
    }

    const counts = {
      SHORT_PAID: 0,
      OVER_PAID: 0,
      MISSING: 0,
      UNKNOWN_CONSIGNMENT: 0,
      GATEWAY_UNMATCHED: 0,
      total: 0,
    };
    for (const e of memExceptions.values()) {
      if (e.status === "OPEN") {
        counts[e.kind]++;
        counts.total++;
      }
    }
    return counts;
  },

  // --------------------------------------------------------------------------
  // Gateway Settlements & Lines (P34)
  // --------------------------------------------------------------------------
  async createGatewaySettlement(
    tx: Tx | undefined,
    data: InsertGatewaySettlementRow
  ): Promise<GatewaySettlementRow> {
    const client = tx ?? defaultDb;
    const id = data.id || crypto.randomUUID();
    const row: GatewaySettlementRow = {
      ...data,
      id,
      fileMediaId: data.fileMediaId ?? null,
      source: data.source ?? "CSV",
      status: data.status ?? "IMPORTED",
      createdAt: data.createdAt ?? new Date(),
    };

    try {
      const [created] = await client.insert(gatewaySettlements).values(row).returning();
      if (created) {
        memGatewaySettlements.set(id, created);
        return created;
      }
    } catch {
      // Fallback
    }
    memGatewaySettlements.set(id, row);
    return row;
  },

  async getGatewaySettlementById(
    tx: Tx | undefined,
    id: string
  ): Promise<GatewaySettlementRow | null> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(gatewaySettlements)
        .where(eq(gatewaySettlements.id, id))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Fallback
    }
    return memGatewaySettlements.get(id) ?? null;
  },

  async getGatewaySettlementByPayoutRef(
    tx: Tx | undefined,
    payoutRef: string
  ): Promise<GatewaySettlementRow | null> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(gatewaySettlements)
        .where(eq(gatewaySettlements.payoutRef, payoutRef))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Fallback
    }
    for (const s of memGatewaySettlements.values()) {
      if (s.payoutRef === payoutRef) return s;
    }
    return null;
  },

  async updateGatewaySettlement(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertGatewaySettlementRow>
  ): Promise<GatewaySettlementRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(gatewaySettlements)
        .set(updates)
        .where(eq(gatewaySettlements.id, id))
        .returning();
      if (updated) {
        memGatewaySettlements.set(id, updated);
        return updated;
      }
    } catch {
      // Fallback
    }
    const existing = memGatewaySettlements.get(id);
    if (!existing) {
      throw new Error(`Gateway settlement '${id}' not found`);
    }
    const merged: GatewaySettlementRow = {
      ...existing,
      ...updates,
    };
    memGatewaySettlements.set(id, merged);
    return merged;
  },

  async createGatewaySettlementLines(
    tx: Tx | undefined,
    lines: InsertGatewaySettlementLineRow[]
  ): Promise<GatewaySettlementLineRow[]> {
    if (lines.length === 0) return [];
    const client = tx ?? defaultDb;
    const rowsToInsert = lines.map((l) => ({
      ...l,
      id: l.id || crypto.randomUUID(),
      feePaisa: l.feePaisa ?? 0,
      matchStatus: l.matchStatus ?? "PENDING",
      resolutionNotes: l.resolutionNotes ?? null,
      resolvedBy: l.resolvedBy ?? null,
      createdAt: l.createdAt ?? new Date(),
    }));

    try {
      const created = await client.insert(gatewaySettlementLines).values(rowsToInsert).returning();
      if (created.length > 0) {
        for (const row of created) {
          memGatewaySettlementLines.set(row.id, row);
        }
        return created;
      }
    } catch {
      // Fallback
    }

    for (const row of rowsToInsert) {
      memGatewaySettlementLines.set(row.id, row as GatewaySettlementLineRow);
    }
    return rowsToInsert as GatewaySettlementLineRow[];
  },

  async getGatewayLinesBySettlementId(
    tx: Tx | undefined,
    settlementId: string
  ): Promise<GatewaySettlementLineRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(gatewaySettlementLines)
        .where(eq(gatewaySettlementLines.settlementId, settlementId));
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return Array.from(memGatewaySettlementLines.values()).filter(
      (l) => l.settlementId === settlementId
    );
  },

  async updateGatewaySettlementLine(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertGatewaySettlementLineRow>
  ): Promise<GatewaySettlementLineRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(gatewaySettlementLines)
        .set(updates)
        .where(eq(gatewaySettlementLines.id, id))
        .returning();
      if (updated) {
        memGatewaySettlementLines.set(id, updated);
        return updated;
      }
    } catch {
      // Fallback
    }
    const existing = memGatewaySettlementLines.get(id);
    if (!existing) {
      throw new Error(`Gateway settlement line '${id}' not found`);
    }
    const merged: GatewaySettlementLineRow = {
      ...existing,
      ...updates,
    };
    memGatewaySettlementLines.set(id, merged);
    return merged;
  },

  async getUnreconciledGatewayTotalPaisa(tx?: Tx): Promise<number> {
    let total = 0;
    for (const e of memExceptions.values()) {
      if (e.kind === "GATEWAY_UNMATCHED" && e.status === "OPEN") {
        total += e.amountPaisa;
      }
    }
    return total;
  },
};
