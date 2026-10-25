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
