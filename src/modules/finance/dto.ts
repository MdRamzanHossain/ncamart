import { z } from "zod";
import {
  invoiceTypeEnum,
  InvoiceLineSnapshot,
  courierSettlementSourceEnum,
  courierSettlementStatusEnum,
  courierMatchStatusEnum,
  settlementExceptionKindEnum,
  settlementExceptionStatusEnum,
  settlementExceptionResolutionEnum,
  gatewaySettlementStatusEnum,
  gatewayMatchStatusEnum,
  exportJobStatusEnum,
  exportFormatEnum,
} from "./schema";

export {
  invoiceTypeEnum,
  courierSettlementSourceEnum,
  courierSettlementStatusEnum,
  courierMatchStatusEnum,
  settlementExceptionKindEnum,
  settlementExceptionStatusEnum,
  settlementExceptionResolutionEnum,
  gatewaySettlementStatusEnum,
  gatewayMatchStatusEnum,
  exportJobStatusEnum,
  exportFormatEnum,
};
export type { InvoiceLineSnapshot };

// --------------------------------------------------------------------------
// Invoice DTOs
// --------------------------------------------------------------------------
export const InvoiceLineSnapshotSchema = z.object({
  skuId: z.string().uuid(),
  skuCode: z.string(),
  titleEn: z.string(),
  titleBn: z.string().optional(),
  qty: z.number().int().positive(),
  unitPricePaisa: z.number().int().nonnegative(),
  vatRateBp: z.number().int().nonnegative(),
  vatPaisa: z.number().int().nonnegative(),
  lineTotalPaisa: z.number().int().nonnegative(),
});

export const InvoiceDtoSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  invoiceNo: z.string(),
  type: z.enum(invoiceTypeEnum),
  mushakSerial: z.string().nullable(),
  fiscalYear: z.string(),
  buyerName: z.string(),
  buyerBin: z.string().nullable(),
  sellerBin: z.string(),
  lines: z.array(InvoiceLineSnapshotSchema),
  subtotalPaisa: z.number().int(),
  vatPaisa: z.number().int(),
  totalPaisa: z.number().int(),
  pdfMediaId: z.string().uuid().nullable(),
  issuedAt: z.date(),
  createdAt: z.date(),
});

export type InvoiceDto = z.infer<typeof InvoiceDtoSchema>;

export const CreateInvoiceInputSchema = z.object({
  orderId: z.string().uuid(),
  type: z.enum(invoiceTypeEnum),
  buyerName: z.string().min(1),
  buyerBin: z.string().optional().nullable(),
  sellerBin: z.string().min(1),
  lines: z.array(InvoiceLineSnapshotSchema),
  subtotalPaisa: z.number().int().nonnegative(),
  vatPaisa: z.number().int().nonnegative(),
  totalPaisa: z.number().int().nonnegative(),
  issuedAt: z.date().optional(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

// --------------------------------------------------------------------------
// P34: Courier CSV Reconciliation DTOs
// --------------------------------------------------------------------------
export const ShortPaidExceptionDtoSchema = z.object({
  tracking_code: z.string(),
  expected_paisa: z.number().int(),
  received_paisa: z.number().int(),
  variance_paisa: z.number().int(),
});

export type ShortPaidExceptionDto = z.infer<typeof ShortPaidExceptionDtoSchema>;

export const OverPaidExceptionDtoSchema = z.object({
  tracking_code: z.string(),
  expected_paisa: z.number().int(),
  received_paisa: z.number().int(),
  variance_paisa: z.number().int(),
});

export type OverPaidExceptionDto = z.infer<typeof OverPaidExceptionDtoSchema>;

export const UnknownConsignmentDtoSchema = z.object({
  tracking_code: z.string(),
  received_paisa: z.number().int(),
});

export type UnknownConsignmentDto = z.infer<typeof UnknownConsignmentDtoSchema>;

/**
 * Adheres strictly to api-spec §14.2 response shape.
 */
export const CourierReconciliationResponseSchema = z.object({
  settlement_id: z.string().uuid().optional(),
  payout_ref: z.string().optional(),
  courier_partner: z.string().optional(),
  status: z.string().optional(),
  matched_consignments: z.number().int().nonnegative(),
  short_paid_exceptions: z.array(ShortPaidExceptionDtoSchema),
  over_paid_exceptions: z.array(OverPaidExceptionDtoSchema).optional().default([]),
  unknown_consignments: z.array(UnknownConsignmentDtoSchema).optional().default([]),
  missing_exceptions_older_7d: z.number().int().nonnegative(),
  total_remitted_paisa: z.number().int().nonnegative(),
  total_charges_paisa: z.number().int().nonnegative().optional(),
  net_paisa: z.number().int().optional(),
});

export type CourierReconciliationResponse = z.infer<typeof CourierReconciliationResponseSchema>;

// --------------------------------------------------------------------------
// P34: Gateway Settlement DTOs
// --------------------------------------------------------------------------
export const GatewaySettlementResponseSchema = z.object({
  settlement_id: z.string().uuid(),
  payout_ref: z.string(),
  gross_amount_paisa: z.number().int(),
  total_fee_paisa: z.number().int(),
  net_paisa: z.number().int(),
  matched_count: z.number().int(),
  unmatched_count: z.number().int(),
  status: z.string(),
});

export type GatewaySettlementResponse = z.infer<typeof GatewaySettlementResponseSchema>;

// --------------------------------------------------------------------------
// P34: Exceptions Workflow DTOs
// --------------------------------------------------------------------------
export const ResolveExceptionInputSchema = z.object({
  resolution: z.enum(settlementExceptionResolutionEnum),
  notes: z.string().optional(),
});

export type ResolveExceptionInput = z.infer<typeof ResolveExceptionInputSchema>;

export const ListExceptionsQuerySchema = z.object({
  status: z.enum(settlementExceptionStatusEnum).optional(),
  kind: z.enum(settlementExceptionKindEnum).optional(),
  older_than_days: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ListExceptionsQuery = z.infer<typeof ListExceptionsQuerySchema>;

// --------------------------------------------------------------------------
// P34: Finance Dashboard Counts DTOs
// --------------------------------------------------------------------------
export const ReceivableAgingSchema = z.object({
  bucket_0_7_days_paisa: z.number().int(),
  bucket_8_15_days_paisa: z.number().int(),
  bucket_16_30_days_paisa: z.number().int(),
  bucket_30_plus_days_paisa: z.number().int(),
  total_receivable_paisa: z.number().int(),
  unreconciled_older_7d_count: z.number().int(),
});

export const OpenExceptionsCountSchema = z.object({
  total: z.number().int(),
  by_kind: z.object({
    SHORT_PAID: z.number().int(),
    OVER_PAID: z.number().int(),
    MISSING: z.number().int(),
    UNKNOWN_CONSIGNMENT: z.number().int(),
    GATEWAY_UNMATCHED: z.number().int(),
  }),
});

export const FinanceDashboardSummarySchema = z.object({
  open_exceptions: OpenExceptionsCountSchema,
  receivable_aging: ReceivableAgingSchema,
  unreconciled_gateway_total_paisa: z.number().int(),
  open_float_sessions: z.number().int(),
  open_drawers: z.number().int(),
  pending_refunds: z.number().int(),
});

export type FinanceDashboardSummary = z.infer<typeof FinanceDashboardSummarySchema>;

// ============================================================================
// P35: Financial Reports & Exports DTOs
// ============================================================================

export const ReportFormatSchema = z.enum(["json", "csv", "xlsx"]);
export type ReportFormat = z.infer<typeof ReportFormatSchema>;

export const ReportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  asOf: z.string().optional(),
  format: ReportFormatSchema.default("json"),
});
export type ReportQueryDto = z.infer<typeof ReportQuerySchema>;

// 1. Trial Balance Report
export const TrialBalanceAccountLineSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  normalSide: z.enum(["DEBIT", "CREDIT"]),
  debitPaisa: z.number().int(),
  creditPaisa: z.number().int(),
  netBalancePaisa: z.number().int(),
});
export type TrialBalanceAccountLine = z.infer<typeof TrialBalanceAccountLineSchema>;

export const TrialBalanceReportSchema = z.object({
  asOf: z.string(),
  accounts: z.array(TrialBalanceAccountLineSchema),
  totalDebitPaisa: z.number().int(),
  totalCreditPaisa: z.number().int(),
  differencePaisa: z.number().int(),
  isBalanced: z.boolean(),
});
export type TrialBalanceReportDto = z.infer<typeof TrialBalanceReportSchema>;

// 2. Profit and Loss Report
export const ProfitAndLossRevenueSchema = z.object({
  salesRevenuePaisa: z.number().int(),
  deliveryFeeRevenuePaisa: z.number().int(),
  forfeitedDepositRevenuePaisa: z.number().int(),
  grossRevenuePaisa: z.number().int(),
});

export const ProfitAndLossContraRevenueSchema = z.object({
  salesDiscountsPaisa: z.number().int(),
  salesReturnsPaisa: z.number().int(),
  totalContraRevenuePaisa: z.number().int(),
});

export const ProfitAndLossExpensesSchema = z.object({
  courierDeliveryChargesPaisa: z.number().int(),
  codChargesPaisa: z.number().int(),
  rtoChargesPaisa: z.number().int(),
  gatewayFeesPaisa: z.number().int(),
  inventoryWriteOffPaisa: z.number().int(),
  cashVariancePaisa: z.number().int(),
  goodwillVouchersPaisa: z.number().int(),
  totalExpensesPaisa: z.number().int(),
});

export const ProfitAndLossReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  revenue: ProfitAndLossRevenueSchema,
  contraRevenue: ProfitAndLossContraRevenueSchema,
  netRevenuePaisa: z.number().int(),
  cogsPaisa: z.number().int(),
  grossMarginPaisa: z.number().int(),
  grossMarginPercentage: z.number(),
  expenses: ProfitAndLossExpensesSchema,
  netProfitPaisa: z.number().int(),
});
export type ProfitAndLossReportDto = z.infer<typeof ProfitAndLossReportSchema>;

// 3. Courier Receivable Aging Report
export const CourierAgingBucketSchema = z.object({
  courier: z.string(),
  bucket_0_7_days_paisa: z.number().int(),
  bucket_8_15_days_paisa: z.number().int(),
  bucket_16_30_days_paisa: z.number().int(),
  bucket_30_plus_days_paisa: z.number().int(),
  totalReceivablePaisa: z.number().int(),
  openConsignmentsCount: z.number().int(),
});
export type CourierAgingBucket = z.infer<typeof CourierAgingBucketSchema>;

export const CourierReceivableAgingReportSchema = z.object({
  asOf: z.string(),
  byCourier: z.array(CourierAgingBucketSchema),
  summary: z.object({
    bucket_0_7_days_paisa: z.number().int(),
    bucket_8_15_days_paisa: z.number().int(),
    bucket_16_30_days_paisa: z.number().int(),
    bucket_30_plus_days_paisa: z.number().int(),
    totalReceivablePaisa: z.number().int(),
    unreconciledOlder7dCount: z.number().int(),
  }),
});
export type CourierReceivableAgingReportDto = z.infer<typeof CourierReceivableAgingReportSchema>;

// 4. Customer Deposits Report (Account 2010 per open pre-order)
export const CustomerDepositItemSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  skuId: z.string().optional(),
  skuTitle: z.string().optional(),
  status: z.string(),
  depositPaidPaisa: z.number().int(),
  balanceDuePaisa: z.number().int(),
  depositHeldPaisa: z.number().int(),
  createdAt: z.string(),
});
export type CustomerDepositItem = z.infer<typeof CustomerDepositItemSchema>;

export const CustomerDepositsReportSchema = z.object({
  asOf: z.string(),
  account2010BalancePaisa: z.number().int(),
  openPreOrdersCount: z.number().int(),
  totalDepositsHeldPaisa: z.number().int(),
  items: z.array(CustomerDepositItemSchema),
});
export type CustomerDepositsReportDto = z.infer<typeof CustomerDepositsReportSchema>;

// 5. Store Credit Liability Report (Account 2020)
export const CustomerStoreCreditItemSchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
  phone: z.string(),
  withdrawablePaisa: z.number().int(),
  goodwillPaisa: z.number().int(),
  totalBalancePaisa: z.number().int(),
});
export type CustomerStoreCreditItem = z.infer<typeof CustomerStoreCreditItemSchema>;

export const UpcomingCreditExpirySchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
  amountPaisa: z.number().int(),
  expiresAt: z.string(),
});
export type UpcomingCreditExpiry = z.infer<typeof UpcomingCreditExpirySchema>;

export const StoreCreditLiabilityReportSchema = z.object({
  asOf: z.string(),
  account2020BalancePaisa: z.number().int(),
  totalWithdrawablePaisa: z.number().int(),
  totalGoodwillPaisa: z.number().int(),
  totalLiabilityPaisa: z.number().int(),
  customers: z.array(CustomerStoreCreditItemSchema),
  upcomingExpiries: z.array(UpcomingCreditExpirySchema),
});
export type StoreCreditLiabilityReportDto = z.infer<typeof StoreCreditLiabilityReportSchema>;

// 6. Runner Float Status Report
export const RunnerFloatSessionItemSchema = z.object({
  sessionId: z.string(),
  runnerId: z.string(),
  runnerName: z.string(),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  status: z.string(),
  issuedPaisa: z.number().int(),
  purchasesCashPaisa: z.number().int(),
  returnedPaisa: z.number().int(),
  variancePaisa: z.number().int(),
  varianceReason: z.string().nullable(),
  smSignoff: z.boolean(),
  foSignoff: z.boolean(),
});
export type RunnerFloatSessionItem = z.infer<typeof RunnerFloatSessionItemSchema>;

export const RunnerFloatStatusReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  openSessionsCount: z.number().int(),
  totalIssuedPaisa: z.number().int(),
  totalPurchasesPaisa: z.number().int(),
  totalReturnedPaisa: z.number().int(),
  totalVariancePaisa: z.number().int(),
  sessions: z.array(RunnerFloatSessionItemSchema),
});
export type RunnerFloatStatusReportDto = z.infer<typeof RunnerFloatStatusReportSchema>;

// 7. Supplier Payables Report (Account 2200)
export const SupplierPayableAgingItemSchema = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  stallNo: z.string(),
  market: z.string(),
  phone: z.string(),
  bucket_0_7_days_paisa: z.number().int(),
  bucket_8_15_days_paisa: z.number().int(),
  bucket_16_30_days_paisa: z.number().int(),
  bucket_30_plus_days_paisa: z.number().int(),
  totalPayablePaisa: z.number().int(),
});
export type SupplierPayableAgingItem = z.infer<typeof SupplierPayableAgingItemSchema>;

export const SupplierPayablesReportSchema = z.object({
  asOf: z.string(),
  account2200BalancePaisa: z.number().int(),
  totalPayablePaisa: z.number().int(),
  suppliers: z.array(SupplierPayableAgingItemSchema),
});
export type SupplierPayablesReportDto = z.infer<typeof SupplierPayablesReportSchema>;

// 8. VAT Sales Register Report (NBR Mushak 6.3)
export const VatSalesInvoiceItemSchema = z.object({
  invoiceDate: z.string(),
  invoiceNo: z.string(),
  mushakNo: z.string().nullable(),
  buyerName: z.string(),
  buyerBin: z.string().nullable(),
  netSalesPaisa: z.number().int(),
  vatRate: z.number(), // in percent, e.g. 5, 7.5, 15
  vatAmountPaisa: z.number().int(),
  totalAmountPaisa: z.number().int(),
});
export type VatSalesInvoiceItem = z.infer<typeof VatSalesInvoiceItemSchema>;

export const VatSalesRegisterReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  totalInvoices: z.number().int(),
  totalNetSalesPaisa: z.number().int(),
  totalVatPaisa: z.number().int(),
  totalGrandAmountPaisa: z.number().int(),
  byVatRate: z.array(
    z.object({
      ratePercent: z.number(),
      netAmountPaisa: z.number().int(),
      vatAmountPaisa: z.number().int(),
    })
  ),
  invoices: z.array(VatSalesInvoiceItemSchema),
});
export type VatSalesRegisterReportDto = z.infer<typeof VatSalesRegisterReportSchema>;

// 9. Refunds Register Report
export const RefundRegisterItemSchema = z.object({
  refundId: z.string(),
  refundNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string().optional(),
  customerName: z.string(),
  method: z.string(),
  status: z.string(),
  amountPaisa: z.number().int(),
  requestedAt: z.string(),
  approvedAt: z.string().nullable(),
  executedAt: z.string().nullable(),
  initiationBreached: z.boolean(),
  completionBreached: z.boolean(),
  slaStatus: z.enum(["WITHIN_SLA", "INITIATION_BREACH", "COMPLETION_BREACH"]),
});
export type RefundRegisterItem = z.infer<typeof RefundRegisterItemSchema>;

export const RefundsRegisterReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  totalRefunds: z.number().int(),
  totalAmountPaisa: z.number().int(),
  slaBreachesCount: z.number().int(),
  byStatus: z.record(z.string(), z.number().int()),
  byMethod: z.record(z.string(), z.number().int()),
  refunds: z.array(RefundRegisterItemSchema),
});
export type RefundsRegisterReportDto = z.infer<typeof RefundsRegisterReportSchema>;

// 10. Operations KPIs Report
export const KpiOperationsReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  conversion: z.object({
    totalSessions: z.number().int(),
    authenticViews: z.number().int(),
    authenticOrders: z.number().int(),
    authenticConversionRate: z.number(),
    budgetViews: z.number().int(),
    budgetOrders: z.number().int(),
    budgetConversionRate: z.number(),
    overallConversionRate: z.number(),
  }),
  returnReplacementRate: z.object({
    authenticTier: z.object({
      delivered: z.number().int(),
      returnedOrReplaced: z.number().int(),
      ratePercent: z.number(),
      targetPercent: z.number(),
    }),
    budgetSmartTier: z.object({
      delivered: z.number().int(),
      returnedOrReplaced: z.number().int(),
      ratePercent: z.number(),
      targetPercent: z.number(),
    }),
  }),
  doaRate: z.object({
    deliveredUnits: z.number().int(),
    doaUnits: z.number().int(),
    ratePercent: z.number(),
    targetPercent: z.number(),
  }),
  rtoRate: z.object({
    dispatchedCodOrders: z.number().int(),
    rtoOrders: z.number().int(),
    ratePercent: z.number(),
    targetPercent: z.number(),
  }),
  avgDhakaDeliveryTimeHours: z.number(),
  rmaTatHours: z.object({
    dhakaAvgHours: z.number(),
    nationwideAvgHours: z.number(),
    targetDhakaHours: z.number(),
  }),
  preOrderFulfilmentRate: z.object({
    depositsTaken: z.number().int(),
    deliveredOrders: z.number().int(),
    ratePercent: z.number(),
    targetPercent: z.number(),
  }),
  supplierDefectScores: z.array(
    z.object({
      supplierId: z.string(),
      supplierName: z.string(),
      stallNo: z.string(),
      market: z.string(),
      totalSourced: z.number().int(),
      failedUnits: z.number().int(),
      defectRatePercent: z.number(),
      isSuspended: z.boolean(),
    })
  ),
  verificationEngagementRate: z.object({
    deliveredOrders: z.number().int(),
    sealLookups: z.number().int(),
    ratePercent: z.number(),
    targetPercent: z.number(),
  }),
  grossMarginPerDropPackOrder: z.object({
    orderCount: z.number().int(),
    avgGrossMarginPercent: z.number(),
    targetRange: z.string(),
  }),
  unreconciledSettlementCount: z.object({
    olderThan7Days: z.number().int(),
    totalUnreconciled: z.number().int(),
    targetCount: z.number().int(),
  }),
});
export type KpiOperationsReportDto = z.infer<typeof KpiOperationsReportSchema>;

// Export Jobs DTOs
export const CreateExportJobInputSchema = z.object({
  reportType: z.string().min(1),
  queryParams: z.record(z.string(), z.unknown()).default({}),
  format: ReportFormatSchema.default("json"),
});
export type CreateExportJobInput = z.infer<typeof CreateExportJobInputSchema>;

export const ExportJobResponseSchema = z.object({
  id: z.string().uuid(),
  reportType: z.string(),
  format: z.string(),
  status: z.enum(exportJobStatusEnum),
  fileKey: z.string().nullable().optional(),
  fileSizeBytes: z.number().int().nullable().optional(),
  downloadUrl: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.date(),
  completedAt: z.date().nullable().optional(),
});
export type ExportJobResponse = z.infer<typeof ExportJobResponseSchema>;

