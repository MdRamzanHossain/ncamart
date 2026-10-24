import { z } from "zod";
import { orderStatusEnum } from "@/modules/orders/schema";
import { supportTaskTypeEnum, supportTaskStatusEnum, flashDealStatusEnum } from "./schema";

export const AdminPreorderFilterSchema = z.object({
  status: z.enum(orderStatusEnum).optional(),
  sku_id: z.string().optional(),
  sku: z.string().optional(),
  eta_overdue: z
    .union([
      z.boolean(),
      z.enum(["true", "false"]).transform((v) => v === "true"),
    ])
    .optional(),
  batch_key: z.string().optional(),
  batch: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
export type AdminPreorderFilterDto = z.infer<typeof AdminPreorderFilterSchema>;

export const AdminPreorderSourcedSchema = z.object({
  supplier_ref: z.string().optional().nullable(),
  eta_date: z.coerce.date().optional(),
});
export type AdminPreorderSourcedDto = z.infer<typeof AdminPreorderSourcedSchema>;

export const AdminPreorderImportFailedSchema = z.object({
  reason: z.string().min(1, "Failure reason is required"),
  offer_switch_sku_ids: z.array(z.string().uuid()).optional(),
});
export type AdminPreorderImportFailedDto = z.infer<
  typeof AdminPreorderImportFailedSchema
>;

export const AdminPreorderRepricingSchema = z.object({
  new_unit_price_paisa: z.number().int().positive(),
  fx_change_bp: z.number().int(),
  reason: z.string().min(1, "Repricing reason is required"),
});
export type AdminPreorderRepricingDto = z.infer<
  typeof AdminPreorderRepricingSchema
>;

export const CustomerBalancePaymentSchema = z.object({
  mode: z.enum(["ONLINE", "COD", "COUNTER"]),
  store_credit_paisa: z.number().int().nonnegative().optional().default(0),
});
export type CustomerBalancePaymentDto = z.infer<
  typeof CustomerBalancePaymentSchema
>;

export const CustomerDelayChoiceSchema = z.object({
  choice: z.enum(["CANCEL", "KEEP"]),
});
export type CustomerDelayChoiceDto = z.infer<typeof CustomerDelayChoiceSchema>;

export const CustomerRepricingChoiceSchema = z.object({
  accept: z.boolean(),
});
export type CustomerRepricingChoiceDto = z.infer<
  typeof CustomerRepricingChoiceSchema
>;

export const CustomerSwitchSkuSchema = z.object({
  switch_sku_id: z.string().uuid(),
});
export type CustomerSwitchSkuDto = z.infer<typeof CustomerSwitchSkuSchema>;

export const SupportTaskDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(supportTaskTypeEnum),
  orderId: z.string().uuid(),
  dueAt: z.date(),
  status: z.enum(supportTaskStatusEnum),
  assignedTo: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type SupportTaskDto = z.infer<typeof SupportTaskDtoSchema>;

export const FlashDealDtoSchema = z.object({
  id: z.string().uuid(),
  skuId: z.string().uuid(),
  qty: z.number().int().positive(),
  pricePaisa: z.number().int().positive(),
  startsAt: z.date(),
  endsAt: z.date(),
  status: z.enum(flashDealStatusEnum),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type FlashDealDto = z.infer<typeof FlashDealDtoSchema>;
