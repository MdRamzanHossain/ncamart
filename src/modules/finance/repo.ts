import { eq, and } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import { invoices, InvoiceRow, InsertInvoiceRow, InvoiceType } from "./schema";

const memInvoices = new Map<string, InvoiceRow>();

export function clearMemoryFinanceForTesting(): void {
  memInvoices.clear();
}

export const financeRepo = {
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
};
