import { z } from "zod";

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
