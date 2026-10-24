import { Tx } from "@/lib/db";
import { emitOutbox } from "@/lib/outbox";
import { presignGet } from "@/lib/storage";
import { env } from "@/lib/env";
import { fiscalYearOf } from "@/lib/time";
import { generateInvoiceNumber, generateMushakNumber } from "@/db/counters";
import { hmacSha256 } from "@/lib/crypto";
import { Actor } from "@/lib/http/route";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { ledgerService, postingRules } from "@/modules/ledger";
import { sourcingRepo } from "@/modules/sourcing/repo";
import { SupplierPaymentDto, SupplierRefundDto } from "@/modules/sourcing/dto";
import {
  financeRepo,
  clearMemoryFinanceForTesting as repoClearMemory,
} from "./repo";
import { InvoiceRow, InvoiceLineSnapshot } from "./schema";

export interface OrderForInvoice {
  id: string;
  orderNumber: string;
  customerId: string;
  buyerCompanyName?: string | null;
  buyerBin?: string | null;
  addressSnapshot?: { consigneeName?: string; consignee?: string } | null;
  subtotalPaisa: number;
  vatTotalPaisa: number;
  totalPayablePaisa: number;
  items?: Array<{
    skuId: string;
    skuCode: string;
    titleEn: string;
    titleBn?: string;
    qty: number;
    unitPricePaisa: number;
    vatRateBp: number;
    vatPaisa: number;
    lineTotalPaisa: number;
  }>;
}

export const financeService = {
  /**
   * Generates a SYSTEM invoice upon order confirmation.
   * Idempotent: If a SYSTEM invoice already exists for this order, returns it.
   */
  async createSystemInvoice(
    tx: Tx | undefined,
    order: OrderForInvoice,
    issuedAt: Date = new Date()
  ): Promise<InvoiceRow> {
    const existing = await financeRepo.getInvoiceByOrderAndType(
      tx,
      order.id,
      "SYSTEM"
    );
    if (existing) {
      return existing;
    }

    const fiscalYear = fiscalYearOf(issuedAt);
    const invoiceNo = await generateInvoiceNumber(tx ?? null, issuedAt);

    const lines: InvoiceLineSnapshot[] = (order.items ?? []).map((item) => ({
      skuId: item.skuId,
      skuCode: item.skuCode,
      titleEn: item.titleEn,
      titleBn: item.titleBn,
      qty: item.qty,
      unitPricePaisa: item.unitPricePaisa,
      vatRateBp: item.vatRateBp,
      vatPaisa: item.vatPaisa,
      lineTotalPaisa: item.lineTotalPaisa,
    }));

    const buyerName =
      order.buyerCompanyName ||
      order.addressSnapshot?.consignee ||
      order.addressSnapshot?.consigneeName ||
      "Valued Customer";

    const invoice = await financeRepo.createInvoice(tx, {
      orderId: order.id,
      invoiceNo,
      type: "SYSTEM",
      mushakSerial: null,
      fiscalYear,
      buyerName,
      buyerBin: order.buyerBin ?? null,
      sellerBin: "001234567-0101",
      lines,
      subtotalPaisa: order.subtotalPaisa,
      vatPaisa: order.vatTotalPaisa,
      totalPaisa: order.totalPayablePaisa,
      pdfMediaId: null,
      issuedAt,
    });

    await emitOutbox(tx, {
      type: "finance.system_invoice_created",
      aggregateType: "invoice",
      aggregateId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalPaisa: invoice.totalPaisa,
      },
    });

    return invoice;
  },

  /**
   * Issues a MUSHAK_6_3 VAT invoice with a gapless serial from number_counters
   * within the same transaction. Typically invoked at revenue recognition (delivery/handover).
   */
  async issueMushakInvoice(
    tx: Tx | undefined,
    order: OrderForInvoice,
    issuedAt: Date = new Date()
  ): Promise<InvoiceRow> {
    const existing = await financeRepo.getInvoiceByOrderAndType(
      tx,
      order.id,
      "MUSHAK_6_3"
    );
    if (existing) {
      return existing;
    }

    const fiscalYear = fiscalYearOf(issuedAt);
    // Gapless atomic serial counter within same transaction
    const mushakSerial = await generateMushakNumber(tx ?? null, issuedAt);
    const invoiceNo = await generateInvoiceNumber(tx ?? null, issuedAt);

    const lines: InvoiceLineSnapshot[] = (order.items ?? []).map((item) => ({
      skuId: item.skuId,
      skuCode: item.skuCode,
      titleEn: item.titleEn,
      titleBn: item.titleBn,
      qty: item.qty,
      unitPricePaisa: item.unitPricePaisa,
      vatRateBp: item.vatRateBp,
      vatPaisa: item.vatPaisa,
      lineTotalPaisa: item.lineTotalPaisa,
    }));

    const buyerName =
      order.buyerCompanyName ||
      order.addressSnapshot?.consignee ||
      order.addressSnapshot?.consigneeName ||
      "Valued Customer";

    const invoice = await financeRepo.createInvoice(tx, {
      orderId: order.id,
      invoiceNo,
      type: "MUSHAK_6_3",
      mushakSerial,
      fiscalYear,
      buyerName,
      buyerBin: order.buyerBin ?? null,
      sellerBin: "001234567-0101",
      lines,
      subtotalPaisa: order.subtotalPaisa,
      vatPaisa: order.vatTotalPaisa,
      totalPaisa: order.totalPayablePaisa,
      pdfMediaId: null,
      issuedAt,
    });

    await emitOutbox(tx, {
      type: "finance.mushak_6_3_issued",
      aggregateType: "invoice",
      aggregateId: invoice.id,
      payload: {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        mushakSerial,
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalPaisa: invoice.totalPaisa,
      },
    });

    return invoice;
  },

  /**
   * Retrieve all invoices for an order (both SYSTEM and MUSHAK_6_3 if present).
   */
  async getInvoicesForOrder(
    tx: Tx | undefined,
    orderId: string
  ): Promise<InvoiceRow[]> {
    return financeRepo.getInvoicesByOrderId(tx, orderId);
  },

  /**
   * Retrieve MUSHAK_6_3 invoice for an order.
   */
  async getMushakInvoiceForOrder(
    tx: Tx | undefined,
    orderId: string
  ): Promise<InvoiceRow | null> {
    return financeRepo.getInvoiceByOrderAndType(tx, orderId, "MUSHAK_6_3");
  },

  /**
   * Generate a 5-minute signed URL for invoice PDF download.
   */
  async getSignedUrlForInvoice(
    invoice: InvoiceRow
  ): Promise<{ signedUrl: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const key = `invoices/${invoice.invoiceNo}.pdf`;

    try {
      const url = await presignGet({
        bucket: env.S3_BUCKET_PRIVATE,
        key,
        expiresIn: 300,
      });
      return { signedUrl: url, expiresAt };
    } catch {
      // In-memory / local fallback with signed HMAC token
      const token = hmacSha256(
        `${invoice.id}:${expiresAt.getTime()}`,
        env.APP_ENCRYPTION_KEY
      );
      const url = `/api/v1/finance/invoices/${invoice.id}/download?expires=${expiresAt.getTime()}&token=${token}`;
      return { signedUrl: url, expiresAt };
    }
  },

  /**
   * Retrieve an invoice by its ID.
   */
  async getInvoiceById(id: string): Promise<InvoiceRow | null> {
    return financeRepo.getInvoiceById(undefined, id);
  },

  /**
   * Update the pdfMediaId of an invoice once PDF generation completes.
   */
  async updateInvoicePdfMediaId(
    id: string,
    pdfMediaId: string
  ): Promise<InvoiceRow | null> {
    return financeRepo.updateInvoicePdfMediaId(undefined, id, pdfMediaId);
  },

  /**
   * GET /api/v1/finance/supplier-payables
   * Returns list of suppliers and their outstanding balance from Account 2200.
   */
  async getSupplierPayables(
    actor: Actor
  ): Promise<
    Array<{
      supplierId: string;
      name: string;
      stallNo: string;
      market: string;
      phone: string;
      payablePaisa: number;
      debitPaisa: number;
      creditPaisa: number;
    }>
  > {
    const roles = actor.roles ?? [];
    if (!roles.includes("FINANCE_OFFICER") && !roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenError("Insufficient permissions: requires FINANCE_OFFICER or SUPER_ADMIN");
    }

    const subLedgerBalances = await ledgerService.subLedgerBalance("2200");
    const { items: allSuppliers } = await sourcingRepo.listSuppliers({ limit: 10000 });
    const supplierMap = new Map(allSuppliers.map((s) => [s.id, s]));

    const result = subLedgerBalances.map((b) => {
      const supplier = supplierMap.get(b.subLedgerRef);
      // Account 2200 is liability: normal credit side.
      // netBalancePaisa in ledger is debit - credit. For liability, payable = credit - debit.
      const payablePaisa = b.creditPaisa - b.debitPaisa;
      return {
        supplierId: b.subLedgerRef,
        name: supplier?.name ?? "Unknown Supplier",
        stallNo: supplier?.stallNo ?? "",
        market: supplier?.market ?? "",
        phone: supplier?.phone ?? "",
        payablePaisa,
        debitPaisa: b.debitPaisa,
        creditPaisa: b.creditPaisa,
      };
    });

    return result;
  },

  /**
   * POST /api/v1/finance/supplier-payments
   * Records payment to supplier -> SUPPLIER_PAID ledger entry (Dr 2200 / Cr 1030 or 1000).
   */
  async recordSupplierPayment(
    dto: SupplierPaymentDto,
    actor: Actor
  ): Promise<{ success: boolean; entryId: string; supplierId: string; amountPaisa: number }> {
    const roles = actor.roles ?? [];
    if (!roles.includes("FINANCE_OFFICER") && !roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenError("Insufficient permissions: requires FINANCE_OFFICER or SUPER_ADMIN");
    }

    const supplier = await sourcingRepo.getSupplierById(dto.supplier_id);
    if (!supplier) {
      throw new NotFoundError(`Supplier '${dto.supplier_id}' not found`);
    }

    const entry = await ledgerService.post(
      undefined,
      {
        eventType: "SUPPLIER_PAID",
        sourceType: "SUPPLIER_PAYMENT",
        sourceId: dto.reference ?? crypto.randomUUID(),
        description: `Payment to supplier ${supplier.name} (${supplier.stallNo})`,
        lines: postingRules.SUPPLIER_PAID({
          amountPaisa: dto.amount_paisa,
          supplierId: dto.supplier_id,
          method: dto.method,
        }),
      },
      actor
    );

    await emitOutbox(undefined, {
      type: "finance.supplier_paid",
      aggregateType: "supplier",
      aggregateId: dto.supplier_id,
      payload: {
        supplierId: dto.supplier_id,
        amountPaisa: dto.amount_paisa,
        method: dto.method,
        entryId: entry.id,
      },
    });

    return {
      success: true,
      entryId: entry.id,
      supplierId: dto.supplier_id,
      amountPaisa: dto.amount_paisa,
    };
  },

  /**
   * POST /api/v1/finance/supplier-refunds
   * Supplier cash refunds for rejected batches:
   * - Against a float -> SUPPLIER_CASH_REFUND (Dr 1020 / Cr 1200) + updates float session supplierRefundsPaisa
   * - To office -> SUPPLIER_CASH_REFUND (Dr 1000 / Cr 1200)
   * - As supplier credit note -> SUPPLIER_CREDIT_NOTE (Dr 2200 / Cr 1200)
   */
  async recordSupplierRefund(
    dto: SupplierRefundDto,
    actor: Actor
  ): Promise<{ success: boolean; entryId: string; destination: string; amountPaisa: number }> {
    const roles = actor.roles ?? [];
    if (!roles.includes("FINANCE_OFFICER") && !roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenError("Insufficient permissions: requires FINANCE_OFFICER or SUPER_ADMIN");
    }

    const supplier = await sourcingRepo.getSupplierById(dto.supplier_id);
    if (!supplier) {
      throw new NotFoundError(`Supplier '${dto.supplier_id}' not found`);
    }

    let entry;
    if (dto.destination === "FLOAT") {
      let runnerId = dto.runner_id;
      if (dto.float_session_id) {
        const session = await sourcingRepo.getFloatSessionById(dto.float_session_id);
        if (session) {
          runnerId = session.runnerId;
          await sourcingRepo.updateFloatSession(session.id, {
            supplierRefundsPaisa: session.supplierRefundsPaisa + dto.amount_paisa,
          });
        }
      } else if (runnerId) {
        const active = await sourcingRepo.getActiveFloatSessionForRunner(runnerId);
        if (active) {
          await sourcingRepo.updateFloatSession(active.id, {
            supplierRefundsPaisa: active.supplierRefundsPaisa + dto.amount_paisa,
          });
        }
      }

      entry = await ledgerService.post(
        undefined,
        {
          eventType: "SUPPLIER_CASH_REFUND",
          sourceType: "SUPPLIER_REFUND",
          sourceId: crypto.randomUUID(),
          description: `Supplier cash refund from ${supplier.name} to runner float`,
          lines: postingRules.SUPPLIER_CASH_REFUND({
            amountPaisa: dto.amount_paisa,
            destination: "FLOAT",
            runnerId,
          }),
        },
        actor
      );
    } else if (dto.destination === "OFFICE") {
      entry = await ledgerService.post(
        undefined,
        {
          eventType: "SUPPLIER_CASH_REFUND",
          sourceType: "SUPPLIER_REFUND",
          sourceId: crypto.randomUUID(),
          description: `Supplier cash refund from ${supplier.name} to office`,
          lines: postingRules.SUPPLIER_CASH_REFUND({
            amountPaisa: dto.amount_paisa,
            destination: "OFFICE",
          }),
        },
        actor
      );
    } else {
      // CREDIT_NOTE
      entry = await ledgerService.post(
        undefined,
        {
          eventType: "SUPPLIER_CREDIT_NOTE",
          sourceType: "SUPPLIER_REFUND",
          sourceId: crypto.randomUUID(),
          description: `Supplier credit note for rejected batch from ${supplier.name}`,
          lines: postingRules.SUPPLIER_CREDIT_NOTE({
            amountPaisa: dto.amount_paisa,
            supplierId: dto.supplier_id,
          }),
        },
        actor
      );
    }

    await emitOutbox(undefined, {
      type: "finance.supplier_refund_recorded",
      aggregateType: "supplier",
      aggregateId: dto.supplier_id,
      payload: {
        supplierId: dto.supplier_id,
        amountPaisa: dto.amount_paisa,
        destination: dto.destination,
        entryId: entry.id,
      },
    });

    return {
      success: true,
      entryId: entry.id,
      destination: dto.destination,
      amountPaisa: dto.amount_paisa,
    };
  },

  clearMemoryForTesting(): void {
    repoClearMemory();
  },
};
