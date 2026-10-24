import { z } from "zod";
import {
  locationCodeEnum,
  stockMovementReasonEnum,
  stockReservationStatusEnum,
  stockAdjustmentStatusEnum,
  cycleCountStatusEnum,
  LocationCode,
  StockMovementReason,
  StockReservationStatus,
  StockAdjustmentStatus,
  CycleCountStatus,
  LocationRow,
  InventoryBalanceRow,
  StockMovementRow,
  StockReservationRow,
  StockAdjustmentRequestRow,
  CycleCountRow,
  CycleCountLineRow,
} from "./schema";

export {
  locationCodeEnum,
  stockMovementReasonEnum,
  stockReservationStatusEnum,
  stockAdjustmentStatusEnum,
  cycleCountStatusEnum,
};

export type {
  LocationCode,
  StockMovementReason,
  StockReservationStatus,
  StockAdjustmentStatus,
  CycleCountStatus,
  LocationRow,
  InventoryBalanceRow,
  StockMovementRow,
  StockReservationRow,
  StockAdjustmentRequestRow,
  CycleCountRow,
  CycleCountLineRow,
};

// 1. Receive Stock DTO
export const receiveStockSchema = z.object({
  skuId: z.string().uuid(),
  locationCode: z.enum(locationCodeEnum),
  qty: z.number().int().positive("Quantity must be greater than 0"),
  unitCostPaisa: z.number().int().nonnegative("Unit cost must be non-negative"),
  reason: z.enum(stockMovementReasonEnum).default("PURCHASE_RECEIPT").optional(),
  refType: z.string().min(1).default("PURCHASE"),
  refId: z.string().min(1),
});
export type ReceiveStockDto = z.input<typeof receiveStockSchema>;

// 2. Transfer Stock DTO
export const transferStockSchema = z.object({
  skuId: z.string().uuid(),
  fromLocationCode: z.enum(locationCodeEnum),
  toLocationCode: z.enum(locationCodeEnum),
  qty: z.number().int().positive("Quantity must be greater than 0"),
  reason: z.enum(stockMovementReasonEnum).default("TRANSFER").optional(),
  refType: z.string().min(1).default("TRANSFER"),
  refId: z.string().min(1),
  unitCostPaisa: z.number().int().nonnegative().optional(),
});
export type TransferStockDto = z.input<typeof transferStockSchema>;

// 3. Reserve Stock DTO
export const reserveStockItemSchema = z
  .object({
    orderId: z.string().uuid().optional(),
    cartHoldId: z.string().uuid().optional(),
    orderItemId: z.string().uuid().optional(),
    skuId: z.string().uuid(),
    qty: z.number().int().positive("Quantity must be greater than 0"),
    locationPreference: z.array(z.enum(locationCodeEnum)).min(1),
  })
  .refine(
    (data) => (data.orderId !== undefined) !== (data.cartHoldId !== undefined),
    {
      message: "Exactly one of orderId or cartHoldId must be specified",
    }
  );
export type ReserveStockItemDto = z.input<typeof reserveStockItemSchema>;

// 4. Commit / Release DTO
export const commitReservationSchema = z.object({
  reservationId: z.string().uuid(),
});
export type CommitReservationDto = z.input<typeof commitReservationSchema>;

export const releaseReservationSchema = z.object({
  reservationId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
}).refine((data) => data.reservationId || data.orderId, {
  message: "Either reservationId or orderId must be provided",
});
export type ReleaseReservationDto = z.input<typeof releaseReservationSchema>;

// 5. Stock Adjustment Request DTO
export const createAdjustmentRequestSchema = z.object({
  skuId: z.string().uuid(),
  locationCode: z.enum(locationCodeEnum),
  delta: z.number().int().refine((val) => val !== 0, {
    message: "Delta must be non-zero",
  }),
  reason: z.string().min(3, "Reason required"),
  notes: z.string().optional(),
});
export type CreateAdjustmentRequestDto = z.input<typeof createAdjustmentRequestSchema>;

export const adjudicateAdjustmentSchema = z.object({
  notes: z.string().optional(),
});
export type AdjudicateAdjustmentDto = z.input<typeof adjudicateAdjustmentSchema>;

// 6. Cycle Count DTOs
export const startCycleCountSchema = z.object({
  locationCode: z.enum(locationCodeEnum),
});
export type StartCycleCountDto = z.input<typeof startCycleCountSchema>;

export const cycleCountLineInputSchema = z.object({
  skuId: z.string().uuid(),
  countedQty: z.number().int().nonnegative(),
});

export const submitCycleCountLinesSchema = z.object({
  lines: z.array(cycleCountLineInputSchema).min(1),
});
export type SubmitCycleCountLinesDto = z.input<typeof submitCycleCountLinesSchema>;

// 7. Filters
export const inventoryBalanceFilterSchema = z.object({
  skuId: z.string().uuid().optional(),
  locationCode: z.enum(locationCodeEnum).optional(),
  isSellable: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type InventoryBalanceFilterDto = z.input<typeof inventoryBalanceFilterSchema>;

export const stockMovementFilterSchema = z.object({
  skuId: z.string().uuid().optional(),
  locationCode: z.enum(locationCodeEnum).optional(),
  reason: z.enum(stockMovementReasonEnum).optional(),
  refType: z.string().optional(),
  refId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type StockMovementFilterDto = z.input<typeof stockMovementFilterSchema>;

// 8. Allocation DTOs
export interface AllocateLineItem {
  skuId: string;
  qty: number;
  isPreorder?: boolean;
  isFlashDeal?: boolean;
}

export interface AllocationResultItem {
  skuId: string;
  qty: number;
  source: "PHYSICAL" | "VIRTUAL" | "UNAVAILABLE";
  locationCode?: LocationCode;
  purchasable: boolean;
}

export type SkuAvailabilityStatus = "IN_STOCK" | "AVAILABLE" | "OUT_OF_STOCK";
