import { z } from "zod";

// --------------------------------------------------------------------------
// 1. Cash Drawer DTOs
// --------------------------------------------------------------------------
export const openDrawerSchema = z.object({
  opening_float_paisa: z.number().int().min(0, "Opening float cannot be negative"),
  notes: z.string().optional(),
});
export type OpenDrawerDto = z.infer<typeof openDrawerSchema>;

export const closeDrawerSchema = z.object({
  counted_cash_paisa: z.number().int().min(0, "Counted cash cannot be negative"),
  notes: z.string().optional(),
});
export type CloseDrawerDto = z.infer<typeof closeDrawerSchema>;

export const reconcileDrawerSchema = z.object({
  notes: z.string().optional(),
});
export type ReconcileDrawerDto = z.infer<typeof reconcileDrawerSchema>;

// --------------------------------------------------------------------------
// 2. Pickup PIN Verification DTOs
// --------------------------------------------------------------------------
export const verifyPickupPinSchema = z.object({
  order_number: z.string().min(1, "Order number is required"),
  pickup_pin: z.string().regex(/^\d{6}$/, "Pickup PIN must be exactly 6 numeric digits"),
});
export type VerifyPickupPinDto = z.infer<typeof verifyPickupPinSchema>;

export const resetPickupPinSchema = z.object({
  reason: z.string().optional(),
});
export type ResetPickupPinDto = z.infer<typeof resetPickupPinSchema>;

// --------------------------------------------------------------------------
// 3. Pickup Handover DTOs
// --------------------------------------------------------------------------
export const pickupPaymentSchema = z.object({
  method: z.enum(["CASH", "BKASH_QR", "NAGAD_QR", "CARD_TERMINAL"]),
  amount_paisa: z.number().int().min(1, "Payment amount must be greater than 0"),
  reference: z.string().optional(),
});
export type PickupPaymentDto = z.infer<typeof pickupPaymentSchema>;

export const pickupHandoverSchema = z.object({
  order_id: z.string().uuid("Invalid order ID"),
  customer_inspected_on_bench: z.literal(true, {
    errorMap: () => ({ message: "Customer bench inspection confirmation is mandatory" }),
  }),
  signed_handover_slip: z.literal(true, {
    errorMap: () => ({ message: "Signed handover slip confirmation is mandatory" }),
  }),
  payment: pickupPaymentSchema.optional(),
});
export type PickupHandoverDto = z.infer<typeof pickupHandoverSchema>;

// --------------------------------------------------------------------------
// 4. Walk-In Sale DTOs
// --------------------------------------------------------------------------
export const walkInSaleItemSchema = z.object({
  sku_id: z.string().uuid("Invalid SKU ID"),
  seal_id: z.string().min(1, "Holographic seal ID is required"),
  quantity: z.number().int().min(1).default(1),
});
export type WalkInSaleItemDto = z.infer<typeof walkInSaleItemSchema>;

export const walkInSaleSchema = z.object({
  customer_phone: z.string().min(11, "Valid Bangladesh phone number is required"),
  customer_name: z.string().optional(),
  items: z.array(walkInSaleItemSchema).min(1, "At least one item is required for walk-in sale"),
  payment_mode: z.enum(["CASH", "BKASH_QR", "NAGAD_QR", "CARD_TERMINAL"]),
  paid_amount_paisa: z.number().int().min(1, "Paid amount must be positive"),
  reference: z.string().optional(),
  coupon_code: z.string().optional(),
});
export type WalkInSaleDto = z.infer<typeof walkInSaleSchema>;

// --------------------------------------------------------------------------
// 5. Thermal Receipt & Stock DTOs
// --------------------------------------------------------------------------
export interface ReceiptItemDto {
  title: string;
  sku_code: string;
  qty: number;
  unit_price_paisa: number;
  line_total_paisa: number;
  seal_id: string;
  warranty_days: number;
}

export interface ReceiptPayloadDto {
  receipt_number: string;
  printed_at: string;
  store: {
    name: string;
    address: string;
    hotline: string;
    vat_bin: string;
  };
  order: {
    order_id: string;
    order_number: string;
    channel: string;
    fulfillment: string;
    subtotal_paisa: number;
    discount_paisa: number;
    vat_paisa: number;
    total_paisa: number;
    paid_paisa: number;
  };
  customer: {
    name: string;
    phone_masked: string;
  };
  items: ReceiptItemDto[];
  payment: {
    mode: string;
    paid_amount_paisa: number;
    reference?: string;
  };
  warranty_notice: string;
  escpos_text: string;
}

export interface ShowroomStockItemDto {
  sku_id: string;
  sku_code: string;
  product_id: string;
  title_en: string;
  title_bn: string;
  product_tier: string;
  price_paisa: number;
  warranty_days: number;
  seal_id: string;
  manufacturer_serial: string | null;
  status: string;
}
