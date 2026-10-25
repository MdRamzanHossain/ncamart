import { Tx } from "@/lib/db";
import { emitOutbox } from "@/lib/outbox";
import { presignGet } from "@/lib/storage";
import { env } from "@/lib/env";
import { fiscalYearOf } from "@/lib/time";
import { generateInvoiceNumber, generateMushakNumber } from "@/db/counters";
import { hmacSha256 } from "@/lib/crypto";
import { Actor } from "@/lib/http/route";
import { BusinessError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { ledgerService, postingRules } from "@/modules/ledger";
import { sourcingRepo } from "@/modules/sourcing/repo";
import { SupplierPaymentDto, SupplierRefundDto } from "@/modules/sourcing/dto";
import { logisticsRepo } from "@/modules/logistics/repo";
import { getCourierAdapter } from "@/modules/logistics/adapters";
import { CourierCode } from "@/modules/logistics/schema";
import { ordersRepo } from "@/modules/orders/repo";
import { posRepo } from "@/modules/pos/repo";
import { refundsRepo } from "@/modules/payments/repo";
import {
  financeRepo,
  clearMemoryFinanceForTesting as repoClearMemory,
} from "./repo";
import {
  InvoiceRow,
  InvoiceLineSnapshot,
  CourierSettlementRow,
  CourierSettlementLineRow,
  InsertCourierSettlementLineRow,
  SettlementExceptionRow,
  GatewaySettlementRow,
  InsertGatewaySettlementLineRow,
} from "./schema";
import {
  CourierReconciliationResponse,
  ShortPaidExceptionDto,
  OverPaidExceptionDto,
  UnknownConsignmentDto,
  GatewaySettlementResponse,
  ResolveExceptionInput,
  ListExceptionsQuery,
  FinanceDashboardSummary,
} from "./dto";
import { financePolicies } from "./policies";
import {
  parseCsv,
  extractCourierLines,
  extractGatewayLines,
  CourierColumnMapping,
} from "./csv-parser";

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
   * Supplier cash refunds for rejected batches.
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

  // ==========================================================================
  // P34: Courier COD Reconciliation & Gateway Settlement
  // ==========================================================================

  /**
   * Reconciles a courier COD payout CSV report.
   * Matches lines against courier_shipments by consignment_no.
   * Exact match -> MATCHED, posts COURIER_PAYOUT_MATCHED journal entry, updates shipment charges.
   * Mismatch -> SHORT_PAID / OVER_PAID exception.
   * Unknown -> UNKNOWN_CONSIGNMENT exception.
   * Idempotent per payout_ref.
   */
  async reconcileCourierCsv(
    input: {
      courierPartner: string;
      csvContent: string;
      payoutRef?: string;
      fileMediaId?: string;
      customMapping?: Partial<CourierColumnMapping>;
    },
    actor: Actor
  ): Promise<CourierReconciliationResponse> {
    if (!financePolicies.canReconcileSettlements(actor)) {
      throw new ForbiddenError("Insufficient permissions: requires settlement.reconcile or FINANCE_OFFICER");
    }

    const courierCode = input.courierPartner.toUpperCase().trim() as CourierCode;
    const parsedRows = parseCsv(input.csvContent);
    if (parsedRows.length === 0) {
      throw new ValidationError("CSV file is empty or missing headers");
    }

    const normalizedLines = extractCourierLines(parsedRows, courierCode, input.customMapping);
    if (normalizedLines.length === 0) {
      throw new ValidationError("No valid consignment lines could be parsed from CSV");
    }

    const payoutRef =
      input.payoutRef?.trim() ||
      normalizedLines[0]?.payoutRef ||
      `PAY-${courierCode}-${new Date().toISOString().slice(0, 10)}`;

    // 1. Idempotency check: Re-importing the same (courier, payout_ref) is a no-op returning existing summary
    const existingSettlement = await financeRepo.getCourierSettlementByCourierAndPayoutRef(
      undefined,
      courierCode,
      payoutRef
    );

    if (existingSettlement) {
      const lines = await financeRepo.getLinesBySettlementId(undefined, existingSettlement.id);
      const matchedCount = lines.filter((l) => l.matchStatus === "MATCHED").length;
      const shortPaid = lines
        .filter((l) => l.matchStatus === "SHORT_PAID")
        .map((l) => ({
          tracking_code: l.consignmentNo,
          expected_paisa: l.collectedPaisa + l.variancePaisa,
          received_paisa: l.collectedPaisa,
          variance_paisa: l.variancePaisa,
        }));
      const overPaid = lines
        .filter((l) => l.matchStatus === "OVER_PAID")
        .map((l) => ({
          tracking_code: l.consignmentNo,
          expected_paisa: l.collectedPaisa - l.variancePaisa,
          received_paisa: l.collectedPaisa,
          variance_paisa: l.variancePaisa,
        }));
      const unknownConsignments = lines
        .filter((l) => l.matchStatus === "UNKNOWN_CONSIGNMENT")
        .map((l) => ({
          tracking_code: l.consignmentNo,
          received_paisa: l.collectedPaisa,
        }));

      const { older7dCount } = await this.detectMissingShipments();

      return {
        settlement_id: existingSettlement.id,
        payout_ref: existingSettlement.payoutRef,
        courier_partner: existingSettlement.courier,
        status: existingSettlement.status,
        matched_consignments: matchedCount,
        short_paid_exceptions: shortPaid,
        over_paid_exceptions: overPaid,
        unknown_consignments: unknownConsignments,
        missing_exceptions_older_7d: older7dCount,
        total_remitted_paisa: existingSettlement.grossCollectedPaisa,
        total_charges_paisa: existingSettlement.totalChargesPaisa,
        net_paisa: existingSettlement.netPaisa,
      };
    }

    // 2. Compute settlement header totals
    let grossCollectedPaisa = 0;
    let totalChargesPaisa = 0;
    for (const l of normalizedLines) {
      grossCollectedPaisa += l.collectedPaisa;
      totalChargesPaisa += l.deliveryChargePaisa + l.codChargePaisa + l.returnChargePaisa;
    }
    const netPaisa = grossCollectedPaisa - totalChargesPaisa;

    // 3. Create Settlement Header
    const settlement = await financeRepo.createCourierSettlement(undefined, {
      courier: courierCode,
      payoutRef,
      payoutDate: new Date(),
      grossCollectedPaisa,
      totalChargesPaisa,
      netPaisa,
      source: "CSV",
      fileMediaId: input.fileMediaId ?? null,
      importedBy: actor.id,
      status: "MATCHING",
    });

    let matchedCount = 0;
    const shortPaidExceptions: ShortPaidExceptionDto[] = [];
    const overPaidExceptions: OverPaidExceptionDto[] = [];
    const unknownConsignments: UnknownConsignmentDto[] = [];
    const linesToInsert: InsertCourierSettlementLineRow[] = [];

    // 4. Match lines by consignment_no to courier_shipments
    for (const line of normalizedLines) {
      const shipment = await logisticsRepo.getShipmentByConsignmentNo(line.consignmentNo);

      if (!shipment) {
        // Unknown consignment
        unknownConsignments.push({
          tracking_code: line.consignmentNo,
          received_paisa: line.collectedPaisa,
        });

        const lineId = crypto.randomUUID();
        linesToInsert.push({
          id: lineId,
          settlementId: settlement.id,
          consignmentNo: line.consignmentNo,
          shipmentId: null,
          collectedPaisa: line.collectedPaisa,
          deliveryChargePaisa: line.deliveryChargePaisa,
          codChargePaisa: line.codChargePaisa,
          returnChargePaisa: line.returnChargePaisa,
          matchStatus: "UNKNOWN_CONSIGNMENT",
          variancePaisa: 0,
        });

        await financeRepo.createException(undefined, {
          kind: "UNKNOWN_CONSIGNMENT",
          refIds: {
            settlementId: settlement.id,
            settlementLineId: lineId,
            consignmentNo: line.consignmentNo,
            courier: courierCode,
          },
          amountPaisa: line.collectedPaisa,
          status: "OPEN",
          notes: `Consignment '${line.consignmentNo}' not found in courier shipments`,
        });
        continue;
      }

      // Store the charges and collected COD on the shipment
      await logisticsRepo.updateShipment(shipment.id, {
        collectedCodPaisa: line.collectedPaisa,
        deliveryChargePaisa: line.deliveryChargePaisa,
        codChargePaisa: line.codChargePaisa,
        returnChargePaisa: line.returnChargePaisa,
      });

      const expectedCod = shipment.expectedCodPaisa;
      const totalChargesForLine =
        line.deliveryChargePaisa + line.codChargePaisa + line.returnChargePaisa;
      const netLinePaisa = line.collectedPaisa - totalChargesForLine;
      const lineId = crypto.randomUUID();

      if (line.collectedPaisa === expectedCod) {
        // Exact match -> MATCHED
        matchedCount++;
        linesToInsert.push({
          id: lineId,
          settlementId: settlement.id,
          consignmentNo: line.consignmentNo,
          shipmentId: shipment.id,
          collectedPaisa: line.collectedPaisa,
          deliveryChargePaisa: line.deliveryChargePaisa,
          codChargePaisa: line.codChargePaisa,
          returnChargePaisa: line.returnChargePaisa,
          matchStatus: "MATCHED",
          variancePaisa: 0,
        });

        // Post ledger entry: Dr 1030 (net) + 5100 + 5110 + 5120 / Cr 1110 (Courier COD Receivable)
        await ledgerService.post(
          undefined,
          {
            eventType: "COURIER_PAYOUT_MATCHED",
            sourceType: "COURIER_SETTLEMENT_LINE",
            sourceId: `${settlement.id}:${line.consignmentNo}`,
            description: `Courier COD payout matched for consignment ${line.consignmentNo}`,
            lines: postingRules.COURIER_PAYOUT_MATCHED({
              netPayoutPaisa: netLinePaisa,
              deliveryFeePaisa: line.deliveryChargePaisa,
              codFeePaisa: line.codChargePaisa,
              rtoFeePaisa: line.returnChargePaisa,
              courierId: courierCode,
            }),
          },
          actor
        );
      } else if (line.collectedPaisa < expectedCod) {
        // Short paid mismatch
        const variancePaisa = expectedCod - line.collectedPaisa;
        shortPaidExceptions.push({
          tracking_code: line.consignmentNo,
          expected_paisa: expectedCod,
          received_paisa: line.collectedPaisa,
          variance_paisa: variancePaisa,
        });

        linesToInsert.push({
          id: lineId,
          settlementId: settlement.id,
          consignmentNo: line.consignmentNo,
          shipmentId: shipment.id,
          collectedPaisa: line.collectedPaisa,
          deliveryChargePaisa: line.deliveryChargePaisa,
          codChargePaisa: line.codChargePaisa,
          returnChargePaisa: line.returnChargePaisa,
          matchStatus: "SHORT_PAID",
          variancePaisa,
        });

        await financeRepo.createException(undefined, {
          kind: "SHORT_PAID",
          refIds: {
            settlementId: settlement.id,
            settlementLineId: lineId,
            shipmentId: shipment.id,
            consignmentNo: line.consignmentNo,
            courier: courierCode,
          },
          amountPaisa: variancePaisa,
          status: "OPEN",
          notes: `Short paid by ৳${variancePaisa / 100} (received: ৳${line.collectedPaisa / 100}, expected: ৳${expectedCod / 100})`,
        });

        // Post partial matched remittance if any amount collected/charged
        if (netLinePaisa > 0 || totalChargesForLine > 0) {
          await ledgerService.post(
            undefined,
            {
              eventType: "COURIER_PAYOUT_MATCHED",
              sourceType: "COURIER_SETTLEMENT_LINE",
              sourceId: `${settlement.id}:${line.consignmentNo}:partial`,
              description: `Courier COD partial remittance matched for short-paid consignment ${line.consignmentNo}`,
              lines: postingRules.COURIER_PAYOUT_MATCHED({
                netPayoutPaisa: netLinePaisa,
                deliveryFeePaisa: line.deliveryChargePaisa,
                codFeePaisa: line.codChargePaisa,
                rtoFeePaisa: line.returnChargePaisa,
                courierId: courierCode,
              }),
            },
            actor
          );
        }
      } else {
        // Over paid mismatch
        const variancePaisa = line.collectedPaisa - expectedCod;
        overPaidExceptions.push({
          tracking_code: line.consignmentNo,
          expected_paisa: expectedCod,
          received_paisa: line.collectedPaisa,
          variance_paisa: variancePaisa,
        });

        linesToInsert.push({
          id: lineId,
          settlementId: settlement.id,
          consignmentNo: line.consignmentNo,
          shipmentId: shipment.id,
          collectedPaisa: line.collectedPaisa,
          deliveryChargePaisa: line.deliveryChargePaisa,
          codChargePaisa: line.codChargePaisa,
          returnChargePaisa: line.returnChargePaisa,
          matchStatus: "OVER_PAID",
          variancePaisa,
        });

        await financeRepo.createException(undefined, {
          kind: "OVER_PAID",
          refIds: {
            settlementId: settlement.id,
            settlementLineId: lineId,
            shipmentId: shipment.id,
            consignmentNo: line.consignmentNo,
            courier: courierCode,
          },
          amountPaisa: variancePaisa,
          status: "OPEN",
          notes: `Over paid by ৳${variancePaisa / 100} (received: ৳${line.collectedPaisa / 100}, expected: ৳${expectedCod / 100})`,
        });

        // Post exact matched portion
        await ledgerService.post(
          undefined,
          {
            eventType: "COURIER_PAYOUT_MATCHED",
            sourceType: "COURIER_SETTLEMENT_LINE",
            sourceId: `${settlement.id}:${line.consignmentNo}:overpaid`,
            description: `Courier COD remittance for over-paid consignment ${line.consignmentNo}`,
            lines: postingRules.COURIER_PAYOUT_MATCHED({
              netPayoutPaisa: netLinePaisa,
              deliveryFeePaisa: line.deliveryChargePaisa,
              codFeePaisa: line.codChargePaisa,
              rtoFeePaisa: line.returnChargePaisa,
              courierId: courierCode,
            }),
          },
          actor
        );
      }
    }

    // 5. Bulk insert lines & update status
    await financeRepo.createCourierSettlementLines(undefined, linesToInsert);

    const hasExceptions =
      shortPaidExceptions.length > 0 ||
      overPaidExceptions.length > 0 ||
      unknownConsignments.length > 0;
    const finalStatus = hasExceptions ? "HAS_EXCEPTIONS" : "MATCHED";

    await financeRepo.updateCourierSettlement(undefined, settlement.id, {
      status: finalStatus,
    });

    const { older7dCount } = await this.detectMissingShipments();

    await emitOutbox(undefined, {
      type: "finance.courier_settlement_reconciled",
      aggregateType: "courier_settlement",
      aggregateId: settlement.id,
      payload: {
        settlementId: settlement.id,
        payoutRef,
        courier: courierCode,
        matchedCount,
        hasExceptions,
        netPaisa,
      },
    });

    return {
      settlement_id: settlement.id,
      payout_ref: payoutRef,
      courier_partner: courierCode,
      status: finalStatus,
      matched_consignments: matchedCount,
      short_paid_exceptions: shortPaidExceptions,
      over_paid_exceptions: overPaidExceptions,
      unknown_consignments: unknownConsignments,
      missing_exceptions_older_7d: older7dCount,
      total_remitted_paisa: grossCollectedPaisa,
      total_charges_paisa: totalChargesPaisa,
      net_paisa: netPaisa,
    };
  },

  /**
   * Daily job calls adapter.fetchSettlements where supported.
   */
  async importSettlementsFromApi(
    courierCode: string,
    since?: Date,
    actor?: Actor
  ): Promise<CourierReconciliationResponse | null> {
    const adapter = getCourierAdapter(courierCode);
    if (!adapter.fetchSettlements) {
      return null;
    }

    const effectiveSince = since ?? new Date(Date.now() - 7 * 86400000);
    const lines = await adapter.fetchSettlements(effectiveSince);
    if (!lines || lines.length === 0) {
      return null;
    }

    // Convert adapter settlement lines into CSV format and run reconcile
    const headers = "consignment_no,collected_paisa,delivery_charge_paisa,cod_charge_paisa,return_charge_paisa\n";
    const body = lines
      .map(
        (l) =>
          `${l.consignmentNo},${l.collectedCodPaisa},${l.deliveryChargePaisa},${l.codChargePaisa},${l.returnChargePaisa}`
      )
      .join("\n");
    const csvContent = headers + body;

    const defaultActor: Actor = actor ?? {
      id: "system_cron",
      type: "system",
      roles: ["SUPER_ADMIN"],
      permissions: ["settlement.reconcile"],
    };

    return this.reconcileCourierCsv(
      {
        courierPartner: courierCode,
        csvContent,
        payoutRef: `API-${courierCode.toUpperCase()}-${new Date().toISOString().slice(0, 10)}`,
      },
      defaultActor
    );
  },

  /**
   * MISSING detection job daily 09:00:
   * Delivered shipments not present in any payout after 7 days -> MISSING exception.
   * Courier receivable aging buckets (0–7, 8–15, 16–30, 30+ days).
   * Class A internal alert if any item is older than 7 days (KPI: zero unreconciled > 7 days).
   */
  async detectMissingShipments(asOfDate: Date = new Date()): Promise<{
    missingCreatedCount: number;
    older7dCount: number;
    agingBuckets: {
      bucket_0_7_days_paisa: number;
      bucket_8_15_days_paisa: number;
      bucket_16_30_days_paisa: number;
      bucket_30_plus_days_paisa: number;
      total_receivable_paisa: number;
      unreconciled_older_7d_count: number;
    };
  }> {
    const { shipments } = await logisticsRepo.listShipments({
      status: ["DELIVERED", "PARTIALLY_DELIVERED"],
      limit: 10000,
    });

    let bucket_0_7_days_paisa = 0;
    let bucket_8_15_days_paisa = 0;
    let bucket_16_30_days_paisa = 0;
    let bucket_30_plus_days_paisa = 0;
    let total_receivable_paisa = 0;
    let older7dCount = 0;
    let missingCreatedCount = 0;

    const { items: existingMissing } = await financeRepo.listExceptions(undefined, {
      kind: "MISSING",
      limit: 10000,
    });
    const missingByShipmentId = new Set(
      existingMissing.map((e) => e.refIds?.shipmentId).filter(Boolean)
    );

    for (const s of shipments) {
      if (s.expectedCodPaisa <= 0) continue;
      // If already settled, skip
      if (s.collectedCodPaisa !== null && s.collectedCodPaisa !== undefined && s.collectedCodPaisa > 0) {
        continue;
      }

      const deliveredAt = s.deliveredAt ?? s.createdAt;
      const diffMs = asOfDate.getTime() - deliveredAt.getTime();
      const ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      total_receivable_paisa += s.expectedCodPaisa;

      if (ageDays <= 7) {
        bucket_0_7_days_paisa += s.expectedCodPaisa;
      } else if (ageDays <= 15) {
        bucket_8_15_days_paisa += s.expectedCodPaisa;
        older7dCount++;
      } else if (ageDays <= 30) {
        bucket_16_30_days_paisa += s.expectedCodPaisa;
        older7dCount++;
      } else {
        bucket_30_plus_days_paisa += s.expectedCodPaisa;
        older7dCount++;
      }

      // If older than 7 days, trigger MISSING exception and Class A internal alert
      if (ageDays > 7 && !missingByShipmentId.has(s.id)) {
        await financeRepo.createException(undefined, {
          kind: "MISSING",
          refIds: {
            shipmentId: s.id,
            consignmentNo: s.consignmentNo ?? undefined,
            courier: s.courier,
          },
          amountPaisa: s.expectedCodPaisa,
          status: "OPEN",
          ageDays,
          notes: `Delivered shipment not settled in any payout after ${ageDays} days (consignment: ${s.consignmentNo ?? "unassigned"})`,
        });
        missingCreatedCount++;
        missingByShipmentId.add(s.id);

        // Class A internal alert (PRD §3.13: KPI zero unreconciled > 7 days)
        await emitOutbox(undefined, {
          type: "finance.courier_receivable_overdue",
          aggregateType: "shipment",
          aggregateId: s.id,
          payload: {
            shipmentId: s.id,
            consignmentNo: s.consignmentNo,
            courier: s.courier,
            ageDays,
            amountPaisa: s.expectedCodPaisa,
            alert: "Class A: Delivered shipment unreconciled older than 7 days",
          },
          notificationClass: "A",
        });
      }
    }

    return {
      missingCreatedCount,
      older7dCount,
      agingBuckets: {
        bucket_0_7_days_paisa,
        bucket_8_15_days_paisa,
        bucket_16_30_days_paisa,
        bucket_30_plus_days_paisa,
        total_receivable_paisa,
        unreconciled_older_7d_count: older7dCount,
      },
    };
  },

  /**
   * GET /api/v1/finance/exceptions
   */
  async listExceptions(
    filter: ListExceptionsQuery,
    actor: Actor
  ): Promise<{ items: SettlementExceptionRow[]; total: number }> {
    if (!financePolicies.canResolveExceptions(actor)) {
      throw new ForbiddenError("Insufficient permissions: requires settlement.reconcile or FINANCE_OFFICER");
    }
    return financeRepo.listExceptions(undefined, filter);
  },

  /**
   * POST /api/v1/finance/exceptions/:id/resolve
   * Resolves an exception:
   * - RECEIVED_LATER: marks resolved
   * - ADJUSTED: marks resolved
   * - WRITE_OFF: posts expense entry (Dr 5310 Cash Variance / Cr 1110 or 1100), marks WRITTEN_OFF
   */
  async resolveException(
    id: string,
    input: ResolveExceptionInput,
    actor: Actor
  ): Promise<SettlementExceptionRow> {
    if (!financePolicies.canResolveExceptions(actor)) {
      throw new ForbiddenError("Insufficient permissions: requires settlement.reconcile or FINANCE_OFFICER");
    }

    const exception = await financeRepo.getExceptionById(undefined, id);
    if (!exception) {
      throw new NotFoundError(`Settlement exception '${id}' not found`);
    }

    if (exception.status === "RESOLVED" || exception.status === "WRITTEN_OFF") {
      throw new BusinessError(
        "ERR_EXCEPTION_ALREADY_CLOSED",
        `Exception '${id}' is already ${exception.status}`
      );
    }

    if (input.resolution === "WRITE_OFF") {
      // Post write-off expense entry
      const isGateway = exception.kind === "GATEWAY_UNMATCHED";
      const courierId = (exception.refIds?.courier as string) || "COURIER_DEFAULT";

      await ledgerService.post(
        undefined,
        {
          eventType: "SETTLEMENT_EXCEPTION_WRITTEN_OFF",
          sourceType: "SETTLEMENT_EXCEPTION",
          sourceId: exception.id,
          description: `Settlement exception ${exception.id} written off: ${input.notes ?? ""}`,
          lines: postingRules.SETTLEMENT_EXCEPTION_WRITTEN_OFF({
            amountPaisa: exception.amountPaisa,
            kind: isGateway ? "GATEWAY" : "COURIER",
            courierId,
          }),
        },
        actor
      );

      const updated = await financeRepo.updateException(undefined, id, {
        status: "WRITTEN_OFF",
        resolution: "WRITE_OFF",
        notes: input.notes,
        resolvedBy: actor.id,
        resolvedAt: new Date(),
      });

      if (exception.refIds?.settlementLineId) {
        await financeRepo.updateCourierSettlementLine(
          undefined,
          exception.refIds.settlementLineId,
          {
            matchStatus: "RESOLVED",
            resolutionNotes: `Written off: ${input.notes ?? ""}`,
            resolvedBy: actor.id,
          }
        );
      }

      await emitOutbox(undefined, {
        type: "finance.settlement_exception_resolved",
        aggregateType: "settlement_exception",
        aggregateId: exception.id,
        payload: {
          exceptionId: exception.id,
          resolution: "WRITE_OFF",
          amountPaisa: exception.amountPaisa,
          resolvedBy: actor.id,
        },
      });

      return updated;
    }

    // RECEIVED_LATER or ADJUSTED
    const updated = await financeRepo.updateException(undefined, id, {
      status: "RESOLVED",
      resolution: input.resolution,
      notes: input.notes,
      resolvedBy: actor.id,
      resolvedAt: new Date(),
    });

    if (exception.refIds?.settlementLineId) {
      await financeRepo.updateCourierSettlementLine(
        undefined,
        exception.refIds.settlementLineId,
        {
          matchStatus: "RESOLVED",
          resolutionNotes: `${input.resolution}: ${input.notes ?? ""}`,
          resolvedBy: actor.id,
        }
      );
    }

    await emitOutbox(undefined, {
      type: "finance.settlement_exception_resolved",
      aggregateType: "settlement_exception",
      aggregateId: exception.id,
      payload: {
        exceptionId: exception.id,
        resolution: input.resolution,
        amountPaisa: exception.amountPaisa,
        resolvedBy: actor.id,
      },
    });

    return updated;
  },

  /**
   * Gateway settlements: gateway_settlements + lines.
   * POST /api/v1/finance/gateway-settlements (CSV from SSLCommerz)
   * Match by tran_id -> GATEWAY_SETTLEMENT_MATCHED (Dr 1030 net + 5200 fee / Cr 1100).
   * Unmatched -> exceptions.
   */
  async reconcileGatewaySettlement(
    input: {
      csvContent: string;
      payoutRef?: string;
      fileMediaId?: string;
    },
    actor: Actor
  ): Promise<GatewaySettlementResponse> {
    if (!financePolicies.canReconcileSettlements(actor)) {
      throw new ForbiddenError("Insufficient permissions: requires settlement.reconcile or FINANCE_OFFICER");
    }

    const rows = parseCsv(input.csvContent);
    if (rows.length === 0) {
      throw new ValidationError("CSV file is empty or missing headers");
    }

    const lines = extractGatewayLines(rows);
    if (lines.length === 0) {
      throw new ValidationError("No valid payment transaction lines could be parsed from CSV");
    }

    const payoutRef =
      input.payoutRef?.trim() ||
      lines[0]?.payoutRef ||
      `GW-PAY-${new Date().toISOString().slice(0, 10)}`;

    // Idempotency check: re-importing the same payout_ref is a no-op
    const existing = await financeRepo.getGatewaySettlementByPayoutRef(undefined, payoutRef);
    if (existing) {
      const existingLines = await financeRepo.getGatewayLinesBySettlementId(undefined, existing.id);
      const matchedCount = existingLines.filter((l) => l.matchStatus === "MATCHED").length;
      const unmatchedCount = existingLines.filter((l) => l.matchStatus === "GATEWAY_UNMATCHED").length;
      return {
        settlement_id: existing.id,
        payout_ref: existing.payoutRef,
        gross_amount_paisa: existing.grossAmountPaisa,
        total_fee_paisa: existing.totalFeePaisa,
        net_paisa: existing.netPaisa,
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
        status: existing.status,
      };
    }

    let grossAmountPaisa = 0;
    let totalFeePaisa = 0;
    for (const l of lines) {
      grossAmountPaisa += l.amountPaisa;
      totalFeePaisa += l.feePaisa;
    }
    const netPaisa = grossAmountPaisa - totalFeePaisa;

    const settlement = await financeRepo.createGatewaySettlement(undefined, {
      payoutRef,
      payoutDate: new Date(),
      grossAmountPaisa,
      totalFeePaisa,
      netPaisa,
      source: "CSV",
      fileMediaId: input.fileMediaId ?? null,
      importedBy: actor.id,
      status: "MATCHING",
    });

    let matchedCount = 0;
    let unmatchedCount = 0;
    const linesToInsert: InsertGatewaySettlementLineRow[] = [];

    for (const line of lines) {
      const lineId = crypto.randomUUID();
      const txn = await ordersRepo.findPaymentTransactionByTranId(undefined, line.tranId);

      if (txn) {
        matchedCount++;
        linesToInsert.push({
          id: lineId,
          settlementId: settlement.id,
          tranId: line.tranId,
          amountPaisa: line.amountPaisa,
          feePaisa: line.feePaisa,
          netPaisa: line.netPaisa,
          matchStatus: "MATCHED",
        });

        // Post ledger entry: Dr 1030 net + 5200 fee / Cr 1100 SSLCommerz Clearing
        await ledgerService.post(
          undefined,
          {
            eventType: "GATEWAY_SETTLEMENT_MATCHED",
            sourceType: "GATEWAY_SETTLEMENT_LINE",
            sourceId: `${settlement.id}:${line.tranId}`,
            description: `SSLCommerz gateway settlement matched for transaction ${line.tranId}`,
            lines: postingRules.GATEWAY_SETTLEMENT_MATCHED({
              netSettlementPaisa: line.netPaisa,
              feePaisa: line.feePaisa,
            }),
          },
          actor
        );
      } else {
        unmatchedCount++;
        linesToInsert.push({
          id: lineId,
          settlementId: settlement.id,
          tranId: line.tranId,
          amountPaisa: line.amountPaisa,
          feePaisa: line.feePaisa,
          netPaisa: line.netPaisa,
          matchStatus: "GATEWAY_UNMATCHED",
        });

        await financeRepo.createException(undefined, {
          kind: "GATEWAY_UNMATCHED",
          refIds: {
            settlementId: settlement.id,
            settlementLineId: lineId,
            tranId: line.tranId,
          },
          amountPaisa: line.amountPaisa,
          status: "OPEN",
          notes: `Transaction ID '${line.tranId}' not found in online payment records`,
        });
      }
    }

    await financeRepo.createGatewaySettlementLines(undefined, linesToInsert);

    const finalStatus = unmatchedCount > 0 ? "HAS_EXCEPTIONS" : "MATCHED";
    await financeRepo.updateGatewaySettlement(undefined, settlement.id, {
      status: finalStatus,
    });

    await emitOutbox(undefined, {
      type: "finance.gateway_settlement_reconciled",
      aggregateType: "gateway_settlement",
      aggregateId: settlement.id,
      payload: {
        settlementId: settlement.id,
        payoutRef,
        matchedCount,
        unmatchedCount,
        netPaisa,
      },
    });

    return {
      settlement_id: settlement.id,
      payout_ref: payoutRef,
      gross_amount_paisa: grossAmountPaisa,
      total_fee_paisa: totalFeePaisa,
      net_paisa: netPaisa,
      matched_count: matchedCount,
      unmatched_count: unmatchedCount,
      status: finalStatus,
    };
  },

  /**
   * Dashboard counts endpoint: GET /api/v1/finance/dashboard
   * Open exceptions by kind, receivable aging, unreconciled gateway total,
   * open float sessions, open drawers, pending refunds.
   */
  async getDashboardCounts(actor: Actor): Promise<FinanceDashboardSummary> {
    if (!financePolicies.canViewFinanceDashboard(actor)) {
      throw new ForbiddenError("Insufficient permissions: requires FINANCE_OFFICER, SUPER_ADMIN or ledger.read");
    }

    const openExceptionsCounts = await financeRepo.countOpenExceptionsByKind();
    const { agingBuckets } = await this.detectMissingShipments();
    const unreconciledGatewayTotalPaisa = await financeRepo.getUnreconciledGatewayTotalPaisa();

    const openFloats = await sourcingRepo.listOpenFloatSessions();
    const openDrawers = await posRepo.listDrawerSessions({ status: "OPEN" });
    const refundsList = await refundsRepo.listRefunds({ limit: 1000 });
    const pendingRefunds = refundsList.items.filter(
      (r) => r.status === "REQUESTED" || r.status === "APPROVED" || r.status === "PROCESSING"
    ).length;

    return {
      open_exceptions: {
        total: openExceptionsCounts.total,
        by_kind: {
          SHORT_PAID: openExceptionsCounts.SHORT_PAID,
          OVER_PAID: openExceptionsCounts.OVER_PAID,
          MISSING: openExceptionsCounts.MISSING,
          UNKNOWN_CONSIGNMENT: openExceptionsCounts.UNKNOWN_CONSIGNMENT,
          GATEWAY_UNMATCHED: openExceptionsCounts.GATEWAY_UNMATCHED,
        },
      },
      receivable_aging: agingBuckets,
      unreconciled_gateway_total_paisa: unreconciledGatewayTotalPaisa,
      open_float_sessions: openFloats.length,
      open_drawers: openDrawers.length,
      pending_refunds: pendingRefunds,
    };
  },

  clearMemoryForTesting(): void {
    repoClearMemory();
  },
};
