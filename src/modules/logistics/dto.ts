import { z } from "zod";
import { ShippingCustomerDto } from "@/modules/identity";
import { CourierCode, ShipmentDirection, ShipmentStatus } from "./schema";

// --------------------------------------------------------------------------
// Retry Schedule (PRD §3.7: 1m, 5m, 15m, 30m)
// --------------------------------------------------------------------------
export const COURIER_RETRY_DELAYS_MS = [
  60_000, // 1 minute (Attempt 1)
  300_000, // 5 minutes (Attempt 2)
  900_000, // 15 minutes (Attempt 3)
  1_800_000, // 30 minutes (Attempt 4)
] as const;

export function getNextCourierRetryDelay(attempt: number): number | null {
  if (attempt >= 1 && attempt <= COURIER_RETRY_DELAYS_MS.length) {
    return COURIER_RETRY_DELAYS_MS[attempt - 1] ?? null;
  }
  return null; // Retries exhausted -> mark BOOKING_FAILED
}

// --------------------------------------------------------------------------
// 1. Pack Order DTO
// --------------------------------------------------------------------------
export const unitSealConfirmationSchema = z.object({
  order_item_unit_id: z.string().uuid("order_item_unit_id must be a valid UUID"),
  seal_id: z.string().min(1, "seal_id is required"),
});
export type UnitSealConfirmationDto = z.infer<typeof unitSealConfirmationSchema>;

export const packOrderSchema = z.object({
  package_weight_grams: z
    .number()
    .int()
    .positive("package_weight_grams must be positive integer"),
  unit_seal_confirmations: z
    .array(unitSealConfirmationSchema)
    .min(1, "At least one unit seal confirmation is required"),
});
export type PackOrderDto = z.infer<typeof packOrderSchema>;

// --------------------------------------------------------------------------
// 2. Book Consignment DTO (api-spec §12.2)
// --------------------------------------------------------------------------
export const bookConsignmentSchema = z.object({
  order_id: z.string().uuid("order_id must be a valid UUID"),
  courier_partner: z.string().min(1, "courier_partner is required"),
  package_weight_grams: z.number().int().positive().optional(),
});
export type BookConsignmentDto = z.infer<typeof bookConsignmentSchema>;

// --------------------------------------------------------------------------
// 3. Manual Booking DTO (For couriers without an API)
// --------------------------------------------------------------------------
export const manualBookingSchema = z.object({
  consignment_no: z.string().min(1, "consignment_no is required"),
  tracking_url: z.string().url("tracking_url must be a valid URL").optional(),
});
export type ManualBookingDto = z.infer<typeof manualBookingSchema>;

// --------------------------------------------------------------------------
// 4. Handover DTO
// --------------------------------------------------------------------------
export const handoverSchema = z.object({
  shipment_ids: z
    .array(z.string().uuid("Shipment ID must be a valid UUID"))
    .min(1, "At least one shipment_id is required"),
});
export type HandoverDto = z.infer<typeof handoverSchema>;

// --------------------------------------------------------------------------
// 5. Dev Courier Advancement DTO
// --------------------------------------------------------------------------
export const advanceMockConsignmentSchema = z.object({
  target_status: z.string().optional(),
});
export type AdvanceMockConsignmentDto = z.infer<typeof advanceMockConsignmentSchema>;

// --------------------------------------------------------------------------
// 6. Dispatch Queue DTOs
// --------------------------------------------------------------------------
export interface DispatchQueueItemDto {
  order_id: string;
  order_number: string;
  fulfillment_channel: string;
  order_type: string;
  status: string;
  total_units: number;
  expected_cod_paisa: number;
  placed_at: Date;
  shipping_address: ShippingCustomerDto;
  items_summary: Array<{
    sku_code: string;
    title: string;
    qty: number;
    seals: string[];
  }>;
}

export interface DispatchQueueResponseDto {
  channels: {
    COURIER: DispatchQueueItemDto[];
    PICKUP: DispatchQueueItemDto[];
    WALK_IN: DispatchQueueItemDto[];
  };
  total: number;
}

// --------------------------------------------------------------------------
// 7. Manual Console Response DTO
// --------------------------------------------------------------------------
export interface ManualConsoleItemDto {
  shipment_id: string;
  order_id: string;
  order_number: string;
  courier: string;
  direction: ShipmentDirection;
  status: ShipmentStatus;
  weight_grams: number;
  expected_cod_paisa: number;
  booking_attempts: number;
  last_error: string | null;
  customer_shipping: ShippingCustomerDto;
  created_at: Date;
}

export interface ManualConsoleResponseDto {
  failed_bookings: ManualConsoleItemDto[];
  manual_reverse_pickups: ManualConsoleItemDto[];
  total_actions_needed: number;
}

// --------------------------------------------------------------------------
// 8. Shipping Label DTO
// --------------------------------------------------------------------------
export interface ShippingLabelDto {
  order_number: string;
  consignment_no: string;
  courier: string;
  consignee: ShippingCustomerDto;
  expected_cod_paisa: number;
  expected_cod_bdt: string;
  barcode_data: string;
  tracking_url?: string | null;
  label_svg?: string;
  printable_html?: string;
}
