import { z } from "zod";
import {
  refundReasonEnum,
  refundMethodEnum,
  refundStatusEnum,
  RefundReason,
  RefundMethod,
  RefundStatus,
} from "./schema";

export * from "./client";

export const paymentsStatusDto = z.object({
  status: z.string(),
});

export const InitPaymentSessionInputSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string().min(1),
  tranId: z.string().min(1),
  amountPaisa: z.number().int().positive(),
  currency: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(11),
  customerEmail: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
});

export type InitPaymentSessionInput = z.infer<typeof InitPaymentSessionInputSchema>;

export interface PaymentSessionResult {
  paymentRedirectUrl: string;
  gatewaySessionKey: string;
  tranId: string;
  amountPaisa: number;
}

export const AdminPaymentReviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().optional(),
});

export type AdminPaymentReviewDto = z.infer<typeof AdminPaymentReviewSchema>;

export const AdminPaymentFilterSchema = z.object({
  status: z.string().optional(),
  orderNumber: z.string().optional(),
  tranId: z.string().optional(),
  purpose: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type AdminPaymentFilterDto = {
  status?: string;
  orderNumber?: string;
  tranId?: string;
  purpose?: string;
  page?: number;
  limit?: number;
};

// --------------------------------------------------------------------------
// Refund Schemas & DTOs (P33)
// --------------------------------------------------------------------------

export const requestRefundSchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID"),
  order_item_ids: z.array(z.string()).optional().default([]),
  reason: z.enum(refundReasonEnum),
  method: z.enum(refundMethodEnum).optional(),
  payout_account: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type RequestRefundInput = z.infer<typeof requestRefundSchema>;

export const approveRefundSchema = z.object({
  notes: z.string().optional().nullable(),
});

export type ApproveRefundInput = z.infer<typeof approveRefundSchema>;

export const rejectRefundSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
  notes: z.string().optional().nullable(),
});

export type RejectRefundInput = z.infer<typeof rejectRefundSchema>;

export const executeManualRefundSchema = z.object({
  refund_id: z.string().optional(),
  method: z.enum(["BKASH", "NAGAD", "BANK", "STORE_CREDIT", "GATEWAY", "SSLCOMMERZ_API"]).default("BKASH"),
  external_ref: z.string().min(1, "External payment transaction reference is required"),
  proof_media_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ExecuteManualRefundInput = z.infer<typeof executeManualRefundSchema>;

export const chooseStoreCreditSchema = z.object({
  notes: z.string().optional().nullable(),
});

export type ChooseStoreCreditInput = z.infer<typeof chooseStoreCreditSchema>;

export const listRefundsQuerySchema = z.object({
  status: z.enum(refundStatusEnum).optional(),
  method: z.enum(refundMethodEnum).optional(),
  order_id: z.string().optional(),
  overdue: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .transform((val) => val === true || val === "true" || val === "1")
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListRefundsQuery = z.infer<typeof listRefundsQuerySchema>;

export interface RefundEventDto {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_type: string;
  actor_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface RefundDetailDto {
  id: string;
  refund_number: string;
  order_id: string;
  order_number?: string;
  order_item_ids: string[];
  amount_paisa: number;
  reason: RefundReason;
  method: RefundMethod;
  status: RefundStatus;
  is_before_delivery: boolean;
  requested_by_type: string;
  requested_by_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  executed_by: string | null;
  executed_at: string | null;
  external_ref: string | null;
  proof_media_id: string | null;
  gateway_refund_ref: string | null;
  payout_account_masked: string | null;
  due_by: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  events?: RefundEventDto[];
}
