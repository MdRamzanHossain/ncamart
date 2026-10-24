import { z } from "zod";
import {
  couponTypeEnum,
  couponScopeTypeEnum,
  couponStatusEnum,
  storeCreditReasonEnum,
} from "./schema";

export const CreateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, "Code must contain only letters, numbers, hyphens, and underscores")
      .transform((val) => val.toUpperCase()),
    type: z.enum(couponTypeEnum),
    value: z.number().int().positive("Value must be a positive integer"),
    minOrderPaisa: z.number().int().nonnegative().default(0),
    maxDiscountPaisa: z.number().int().positive().optional(),
    scopeType: z.enum(couponScopeTypeEnum).default("ALL"),
    scopeValues: z.array(z.string().min(1)).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    usageLimit: z.number().int().positive().optional(),
    perPhoneLimit: z.number().int().positive().default(1),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "endsAt must be strictly after startsAt",
    path: ["endsAt"],
  })
  .refine(
    (data) => {
      if (data.type === "PERCENT") {
        return data.value <= 10000;
      }
      return true;
    },
    {
      message: "Percentage coupon value in basis points cannot exceed 10000 (100%)",
      path: ["value"],
    }
  );

export type CreateCouponDto = z.input<typeof CreateCouponSchema>;

export const UpdateCouponSchema = z
  .object({
    type: z.enum(couponTypeEnum).optional(),
    value: z.number().int().positive().optional(),
    minOrderPaisa: z.number().int().nonnegative().optional(),
    maxDiscountPaisa: z.number().int().positive().nullable().optional(),
    scopeType: z.enum(couponScopeTypeEnum).optional(),
    scopeValues: z.array(z.string().min(1)).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    perPhoneLimit: z.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return data.endsAt > data.startsAt;
      }
      return true;
    },
    {
      message: "endsAt must be strictly after startsAt",
      path: ["endsAt"],
    }
  );

export type UpdateCouponDto = z.infer<typeof UpdateCouponSchema>;

export const ListCouponsFilterSchema = z.object({
  status: z.enum(couponStatusEnum).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListCouponsFilterDto = z.input<typeof ListCouponsFilterSchema>;

export const IssueStoreCreditSchema = z.object({
  amountPaisa: z.number().int().positive("Amount must be a positive integer in paisa"),
  reason: z.enum(storeCreditReasonEnum),
  withdrawable: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  refType: z.string().trim().optional(),
  refId: z.string().trim().optional(),
});

export type IssueStoreCreditDto = z.infer<typeof IssueStoreCreditSchema>;

export const WithdrawStoreCreditSchema = z.object({
  amountPaisa: z.number().int().positive("Withdrawal amount must be positive"),
  method: z.enum(["BKASH", "NAGAD", "BANK"]),
  ref: z.string().trim().min(1, "Reference number / transaction id required"),
  notes: z.string().trim().optional(),
});

export type WithdrawStoreCreditDto = z.infer<typeof WithdrawStoreCreditSchema>;

export interface StoreCreditBalanceSummary {
  totalBalancePaisa: number;
  withdrawableBalancePaisa: number;
  nonWithdrawableBalancePaisa: number;
  expiringLots: {
    lotId: string;
    remainingPaisa: number;
    withdrawable: boolean;
    expiresAt: Date | null;
    reason: string;
    createdAt: Date;
  }[];
}
