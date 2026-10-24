import { z } from "zod";
import {
  orderChannelEnum,
  orderTypeEnum,
  fulfillmentChannelEnum,
  deliveryZoneEnum,
  orderStatusEnum,
  paymentModeEnum,
  advancePurposeEnum,
  itemSourceEnum,
  orderItemStatusEnum,
  unitStatusEnum,
  preOrderMilestoneEnum,
  paymentPurposeEnum,
  paymentMethodEnum,
  paymentStatusEnum,
} from "./schema";

export const AddressSnapshotSchema = z.object({
  consignee: z.string().min(1),
  phone: z.string().min(11),
  divisionId: z.string().optional(),
  divisionName: z.string().optional(),
  districtId: z.string().optional(),
  districtName: z.string().optional(),
  thanaId: z.string().optional(),
  thanaName: z.string().optional(),
  areaId: z.string().optional(),
  areaName: z.string().optional(),
  addressLine: z.string().min(1),
  isInsideDhaka: z.boolean(),
});

export const OrderItemUnitInputSchema = z.object({
  sealId: z.string().uuid().optional().nullable(),
  manufacturerSerial: z.string().optional().nullable(),
  status: z.enum(unitStatusEnum).default("PENDING"),
});

export const OrderItemInputSchema = z.object({
  skuId: z.string().uuid(),
  productId: z.string().uuid(),
  titleEn: z.string().min(1),
  titleBn: z.string().min(1),
  tier: z.string().min(1),
  skuCode: z.string().min(1),
  qty: z.number().int().positive(),
  unitPricePaisa: z.number().int().nonnegative(),
  allocatedDiscountPaisa: z.number().int().nonnegative().default(0),
  lineTotalPaisa: z.number().int().nonnegative(),
  vatRateBp: z.number().int().nonnegative(),
  vatPaisa: z.number().int().nonnegative(),
  unitCostPaisa: z.number().int().nonnegative().optional().nullable(),
  source: z.enum(itemSourceEnum),
  sourceLocationId: z.string().uuid().optional().nullable(),
  status: z.enum(orderItemStatusEnum).optional().default("ACTIVE"),
  units: z.array(OrderItemUnitInputSchema).optional(),
});

export const PreOrderInputSchema = z.object({
  depositPaisa: z.number().int().nonnegative(),
  balancePaisa: z.number().int().nonnegative(),
  etaDate: z.coerce.date(),
  etaMinDays: z.number().int().positive(),
  etaMaxDays: z.number().int().positive(),
  priceLockedPaisa: z.number().int().nonnegative(),
  milestone: z.enum(preOrderMilestoneEnum),
  batchKey: z.string().optional().nullable(),
});

export const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  channel: z.enum(orderChannelEnum),
  orderType: z.enum(orderTypeEnum),
  fulfillmentChannel: z.enum(fulfillmentChannelEnum),
  status: z.enum(orderStatusEnum).optional(),
  paymentStatus: z.enum(paymentStatusEnum).optional(),
  deliveryZone: z.enum(deliveryZoneEnum).optional().nullable(),
  paymentMode: z.enum(paymentModeEnum),
  addressSnapshot: AddressSnapshotSchema.optional().nullable(),
  subtotalPaisa: z.number().int().nonnegative(),
  discountPaisa: z.number().int().nonnegative().default(0),
  deliveryFeePaisa: z.number().int().nonnegative().default(0),
  vatTotalPaisa: z.number().int().nonnegative().default(0),
  totalPayablePaisa: z.number().int().nonnegative(),
  storeCreditAppliedPaisa: z.number().int().nonnegative().default(0),
  advanceRequiredPaisa: z.number().int().nonnegative().default(0),
  advancePaidPaisa: z.number().int().nonnegative().default(0),
  advancePurpose: z.enum(advancePurposeEnum).optional().nullable(),
  codAmountPaisa: z.number().int().nonnegative().default(0),
  couponId: z.string().uuid().optional().nullable(),
  mushakRequested: z.boolean().default(false),
  buyerCompanyName: z.string().optional().nullable(),
  buyerBin: z.string().optional().nullable(),
  items: z.array(OrderItemInputSchema).min(1),
  preOrder: PreOrderInputSchema.optional().nullable(),
});

export type CreateOrderDto = z.input<typeof CreateOrderSchema>;

export const TransitionOrderSchema = z.object({
  to: z.enum(orderStatusEnum),
  reason: z.string().trim().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TransitionOrderDto = z.input<typeof TransitionOrderSchema>;

export const CreatePaymentTransactionSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  purpose: z.enum(paymentPurposeEnum),
  method: z.enum(paymentMethodEnum),
  amountPaisa: z.number().int().positive(),
  currency: z.string().optional().default("BDT"),
  gatewaySessionKey: z.string().optional().nullable(),
  valId: z.string().optional().nullable(),
  bankTranId: z.string().optional().nullable(),
  cardType: z.string().optional().nullable(),
  riskLevel: z.string().optional().nullable(),
  riskTitle: z.string().optional().nullable(),
  rawIpn: z.record(z.unknown()).optional().nullable(),
  rawValidation: z.record(z.unknown()).optional().nullable(),
  externalRef: z.string().optional().nullable(),
});

export type CreatePaymentTransactionDto = z.input<
  typeof CreatePaymentTransactionSchema
>;

export const CartValidateItemInputSchema = z.object({
  sku_id: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const CartValidateInputSchema = z.object({
  items: z.array(CartValidateItemInputSchema).min(1),
  coupon_code: z.string().trim().optional().nullable(),
  delivery_zone: z.enum(deliveryZoneEnum).optional().nullable(),
  fulfillment_channel: z.enum(fulfillmentChannelEnum).optional().nullable(),
  store_credit_paisa: z.number().int().nonnegative().optional().nullable(),
});

export type CartValidateInputDto = z.input<typeof CartValidateInputSchema>;

export const CartReserveItemInputSchema = z.object({
  sku_id: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const CartReserveInputSchema = z.object({
  items: z.array(CartReserveItemInputSchema).min(1),
  fulfillment_channel: z.enum(fulfillmentChannelEnum).optional().default("COURIER"),
  location_code: z.string().optional().nullable(),
});

export type CartReserveInputDto = z.input<typeof CartReserveInputSchema>;

export const CustomerCancelOrderSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required"),
});
export type CustomerCancelOrderDto = z.infer<typeof CustomerCancelOrderSchema>;

export const AdminCancelOrderSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required"),
});
export type AdminCancelOrderDto = z.infer<typeof AdminCancelOrderSchema>;

export const AdminAddOrderNoteSchema = z.object({
  note: z.string().min(1, "Note cannot be empty"),
});
export type AdminAddOrderNoteDto = z.infer<typeof AdminAddOrderNoteSchema>;


