import { z } from "zod";
import {
  supplierMarketEnum,
  supplierPaymentModeEnum,
  supplierStatusEnum,
  supplierStockStatusEnum,
  supplierQcOutcomeEnum,
  runnerTaskTypeEnum,
  runnerTaskStatusEnum,
  runnerOverrideDecisionEnum,
  runnerFloatSessionStatusEnum,
  runnerTaskEventActorTypeEnum,
  SupplierRow,
  SupplierStockRow,
  SupplierQcBatchRow,
  RunnerTaskRow,
  InsertRunnerTaskRow,
  RunnerTaskEventRow,
  InsertRunnerTaskEventRow,
  RunnerFloatSessionRow,
  InsertRunnerFloatSessionRow,
  SupplierMarket,
  SupplierPaymentMode,
  SupplierStatus,
  SupplierStockStatus,
  SupplierQcOutcome,
  RunnerTaskType,
  RunnerTaskStatus,
  RunnerOverrideDecision,
  RunnerFloatSessionStatus,
  RunnerTaskEventActorType,
} from "./schema";

export {
  supplierMarketEnum,
  supplierPaymentModeEnum,
  supplierStatusEnum,
  supplierStockStatusEnum,
  supplierQcOutcomeEnum,
  runnerTaskTypeEnum,
  runnerTaskStatusEnum,
  runnerOverrideDecisionEnum,
  runnerFloatSessionStatusEnum,
  runnerTaskEventActorTypeEnum,
};

export type {
  SupplierRow,
  SupplierStockRow,
  SupplierQcBatchRow,
  RunnerTaskRow,
  InsertRunnerTaskRow,
  RunnerTaskEventRow,
  InsertRunnerTaskEventRow,
  RunnerFloatSessionRow,
  InsertRunnerFloatSessionRow,
  SupplierMarket,
  SupplierPaymentMode,
  SupplierStatus,
  SupplierStockStatus,
  SupplierQcOutcome,
  RunnerTaskType,
  RunnerTaskStatus,
  RunnerOverrideDecision,
  RunnerFloatSessionStatus,
  RunnerTaskEventActorType,
};

// 1. Create Supplier DTO
export const createSupplierSchema = z.object({
  name: z.string().min(2).max(255),
  proprietorName: z.string().min(2).max(255),
  market: z.enum(supplierMarketEnum),
  stallNo: z.string().min(1).max(64),
  floor: z.string().min(1).max(32),
  phone: z.string().min(11).max(16),
  bkashMerchantNumber: z.string().min(11).max(16).nullable().optional(),
  acceptedPaymentModes: z
    .array(z.enum(supplierPaymentModeEnum))
    .min(1, "At least one payment mode required"),
});

export type CreateSupplierDto = z.input<typeof createSupplierSchema>;

// 2. Update Supplier DTO
export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierDto = z.input<typeof updateSupplierSchema>;

// 3. Suspend Supplier DTO
export const suspendSupplierSchema = z.object({
  reason: z.string().min(3, "Suspension reason required"),
});
export type SuspendSupplierDto = z.input<typeof suspendSupplierSchema>;

// 4. Update Supplier Stock Batch DTO
export const supplierStockItemSchema = z.object({
  skuId: z.string().uuid(),
  status: z.enum(supplierStockStatusEnum),
  dailyOrderCap: z.number().int().nonnegative().nullable().optional(),
  lastQuotedCostPaisa: z.number().int().nonnegative().nullable().optional(),
  priority: z.number().int().positive().default(1).optional(),
});

export const updateSupplierStockBatchSchema = z.object({
  items: z.array(supplierStockItemSchema).min(1, "At least one SKU stock update required"),
});

export type SupplierStockItemDto = z.input<typeof supplierStockItemSchema>;
export type UpdateSupplierStockBatchDto = z.input<typeof updateSupplierStockBatchSchema>;

// 5. Record QC Batch DTO
export const recordQcBatchSchema = z.object({
  runnerTaskId: z.string().uuid().nullable().optional(),
  unitsTotal: z.number().int().positive("Total units must be at least 1"),
  unitsFailed: z.number().int().nonnegative("Failed units must be >= 0"),
});

export type RecordQcBatchDto = z.input<typeof recordQcBatchSchema>;

// 6. Supplier Filter Query DTO
export const supplierFilterSchema = z.object({
  market: z.enum(supplierMarketEnum).optional(),
  status: z.enum(supplierStatusEnum).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type SupplierFilterDto = z.input<typeof supplierFilterSchema>;

// 7. Sku Suppliers View DTO
export interface SkuSupplierPriorityItem {
  supplier_id: string;
  supplier_name: string;
  market: string;
  stall_no: string;
  floor: string;
  phone: string;
  status: SupplierStatus;
  stock_status: SupplierStockStatus;
  priority: number;
  daily_order_cap: number | null;
  last_quoted_cost_paisa: number | null;
  confirmed_at: Date;
  defect_rate_bp: number;
}

// 8. Runner Task Filter DTO
export const runnerTaskFilterSchema = z.object({
  status: z.enum(runnerTaskStatusEnum).optional(),
  taskType: z.enum(runnerTaskTypeEnum).optional(),
  runnerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  skuId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type RunnerTaskFilterDto = z.input<typeof runnerTaskFilterSchema>;

// 9. Runner Override Request DTO
export const runnerTaskOverrideRequestSchema = z.object({
  quoted_cost_paisa: z.number().int().positive("Quoted cost must be positive paisa"),
  reason: z.string().min(2, "Reason must be at least 2 characters").max(500),
});
export type RunnerTaskOverrideRequestDto = z.input<typeof runnerTaskOverrideRequestSchema>;

// 10. Sourcing Manager Assign Task DTO
export const runnerTaskAssignSchema = z.object({
  runner_id: z.string().uuid("Invalid runner staff id"),
});
export type RunnerTaskAssignDto = z.input<typeof runnerTaskAssignSchema>;

export const runnerTaskOverrideDecisionInputEnum = [
  "APPROVE",
  "APPROVED",
  "REROUTE",
  "REROUTED",
  "DECLINE",
  "DECLINED",
] as const;

export const runnerTaskOverrideDecisionSchema = z.object({
  decision: z.enum(runnerTaskOverrideDecisionInputEnum),
  backup_supplier_id: z.string().uuid().optional(),
});
export type RunnerTaskOverrideDecisionDto = z.input<typeof runnerTaskOverrideDecisionSchema>;

// 12. Customer Stockout Choice DTO
export const stockoutChoiceSchema = z.object({
  choice: z.enum(["REFUND", "ALTERNATE", "BACKORDER"]),
  alternate_sku_id: z.string().uuid().optional(),
});
export type StockoutChoiceDto = z.input<typeof stockoutChoiceSchema>;

// 13. PII-Free Public DTO for Field Runner App (PRD §3.9, api-spec §10.1)
export interface RunnerTaskPublicDto {
  id: string;
  task_number: string;
  task_type: RunnerTaskType;
  status: RunnerTaskStatus;
  order_number: string | null;
  sku_id: string;
  sku_code: string;
  title_en: string;
  title_bn: string;
  tier: string;
  qty: number;
  stall: {
    id: string;
    name: string;
    market: string;
    stall_no: string;
    floor: string;
    phone: string;
    accepted_payment_modes: string[];
  };
  backup_stall: {
    id: string;
    name: string;
    market: string;
    stall_no: string;
    floor: string;
    phone: string;
  } | null;
  max_unit_price_paisa: number;
  quoted_unit_price_paisa: number | null;
  override_decision: RunnerOverrideDecision | null;
  due_at: Date;
  created_at: Date;
}

// ----------------------------------------------------------------------------
// P25 Float Sessions & Offline Sync DTOs
// ----------------------------------------------------------------------------

export const RUNNER_PURCHASE_APPROVAL_THRESHOLD_PAISA = 200_000; // ৳2,000

// 14. Issue Float DTO
export const issueFloatSchema = z.object({
  runner_staff_id: z.string().uuid("Invalid runner staff id"),
  issued_float_paisa: z.number().int().positive("Issued float must be positive paisa"),
});
export type IssueFloatDto = z.input<typeof issueFloatSchema>;

// 15. Count Float DTO
export const countFloatSchema = z.object({
  returned_paisa: z.number().int().min(0, "Returned paisa cannot be negative"),
  variance_reason: z.string().optional(),
});
export type CountFloatDto = z.input<typeof countFloatSchema>;

// 16. Float Signoff DTO
export const floatSignoffSchema = z.object({
  notes: z.string().optional(),
});
export type FloatSignoffDto = z.input<typeof floatSignoffSchema>;

// 17. Runner Declare Return DTO
export const returnFloatSchema = z.object({
  returned_paisa: z.number().int().min(0).optional(),
});
export type ReturnFloatDto = z.input<typeof returnFloatSchema>;

// 18. List Float Sessions Filter DTO
export const listFloatSessionsFilterSchema = z.object({
  status: z.enum(runnerFloatSessionStatusEnum).optional(),
  runner_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListFloatSessionsFilterDto = z.input<typeof listFloatSessionsFilterSchema>;

// 19. Runner Sync Mutation Item
export const runnerSyncMutationTypeEnum = [
  "PURCHASE",
  "TASK_CONTACTED",
  "OVERRIDE_REQUEST",
] as const;
export type RunnerSyncMutationType = (typeof runnerSyncMutationTypeEnum)[number];

export const runnerSyncMutationSchema = z.object({
  client_mutation_id: z.string().min(1, "Client mutation ID is required"),
  type: z.enum(runnerSyncMutationTypeEnum),
  payload: z.record(z.unknown()),
  recorded_at: z.string(),
});
export type RunnerSyncMutation = z.infer<typeof runnerSyncMutationSchema>;

export const runnerSyncBatchSchema = z.object({
  mutations: z.array(runnerSyncMutationSchema).min(1, "Batch must contain at least 1 mutation"),
});
export type RunnerSyncBatchDto = z.infer<typeof runnerSyncBatchSchema>;

// 20. Sync Purchase Payload Schema
export const runnerSyncPurchasePayloadSchema = z.object({
  task_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid(),
  sku_id: z.string().uuid(),
  qty: z.number().int().positive(),
  unit_cost_paisa: z.number().int().positive(),
  amount_paisa: z.number().int().positive(),
  payment_mode: z.enum(["CASH", "SUPPLIER_CREDIT"]),
  receipt_media_id: z.string().uuid().optional().nullable(),
  receipt_missing_flag: z.boolean().optional(),
  device_revoked: z.boolean().optional(),
});
export type RunnerSyncPurchasePayload = z.infer<typeof runnerSyncPurchasePayloadSchema>;

// 21. Single Task Sync Purchase DTO
export const singleTaskSyncPurchaseSchema = z.object({
  supplier_id: z.string().uuid(),
  sku_id: z.string().uuid(),
  qty: z.number().int().positive(),
  unit_cost_paisa: z.number().int().positive(),
  amount_paisa: z.number().int().positive(),
  payment_mode: z.enum(["CASH", "SUPPLIER_CREDIT"]),
  receipt_media_id: z.string().uuid().optional().nullable(),
  receipt_missing_flag: z.boolean().optional(),
  recorded_at: z.string().optional(),
});
export type SingleTaskSyncPurchaseDto = z.infer<typeof singleTaskSyncPurchaseSchema>;

// 22. Sync Item Result & Response DTO
export type RunnerSyncResultStatus = "ok" | "conflict" | "quarantined" | "duplicate" | "error";

export interface RunnerSyncItemResult {
  client_mutation_id: string;
  result: RunnerSyncResultStatus;
  server_ids?: Record<string, string>;
  message?: string;
}

export interface RunnerSyncResponseDto {
  results: RunnerSyncItemResult[];
}

// 23. Receipt Upload DTOs
export const receiptUploadUrlSchema = z.object({
  content_type: z.string().default("image/jpeg"),
  size_bytes: z.number().int().positive().max(10 * 1024 * 1024, "Image size exceeds 10MB limit").default(1024 * 1024),
});
export type ReceiptUploadUrlDto = z.infer<typeof receiptUploadUrlSchema>;

export const receiptCompleteSchema = z.object({
  media_id: z.string().uuid().optional(),
});
export type ReceiptCompleteDto = z.infer<typeof receiptCompleteSchema>;

// 24. Godown Receive Runner Items DTO
export const receiveRunnerItemsSchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1, "At least one task id required"),
});
export type ReceiveRunnerItemsDto = z.infer<typeof receiveRunnerItemsSchema>;

// 25. Supplier Payment DTO
export const supplierPaymentSchema = z.object({
  supplier_id: z.string().uuid(),
  amount_paisa: z.number().int().positive("Amount must be positive paisa"),
  method: z.enum(["BANK", "CASH"]),
  reference: z.string().optional(),
});
export type SupplierPaymentDto = z.infer<typeof supplierPaymentSchema>;

// 26. Supplier Refund DTO
export const supplierRefundSchema = z.object({
  supplier_id: z.string().uuid(),
  amount_paisa: z.number().int().positive("Amount must be positive paisa"),
  destination: z.enum(["FLOAT", "OFFICE", "CREDIT_NOTE"]),
  runner_id: z.string().uuid().optional(),
  float_session_id: z.string().uuid().optional(),
  reason: z.string().optional(),
});
export type SupplierRefundDto = z.infer<typeof supplierRefundSchema>;

export type { RunnerPurchaseRow, InsertRunnerPurchaseRow } from "./schema";

