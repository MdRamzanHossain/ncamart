// Outbox event definitions for module: sourcing
export interface SupplierEventPayload {
  supplierId: string;
  name?: string;
  status?: string;
  reason?: string;
  defectRateBp?: number;
  totalUnitsSourced?: number;
  qcFailedUnits?: number;
  [key: string]: unknown;
}

export interface SupplierStockEventPayload {
  supplierId: string;
  skuCount: number;
  confirmedBy?: string | null;
  [key: string]: unknown;
}

export interface SupplierQcBatchEventPayload {
  batchId: string;
  supplierId: string;
  runnerTaskId?: string | null;
  unitsTotal: number;
  unitsFailed: number;
  outcome: "ACCEPTED" | "RETURNED";
  defectRateBp: number;
  isAutoSuspended: boolean;
}

export interface SupplierStockStaleEventPayload {
  staleCount: number;
  checkedAt: string;
}

export interface RunnerTaskEventPayload {
  taskId: string;
  taskNumber: string;
  taskType: string;
  status: string;
  orderId?: string | null;
  skuId: string;
  runnerId?: string | null;
  [key: string]: unknown;
}

export interface RunnerOverrideRequestedEventPayload {
  taskId: string;
  taskNumber: string;
  runnerId?: string | null;
  quotedUnitPricePaisa: number;
  marginBp: number;
  reason: string;
}

export interface OrderLineUnfulfillableEventPayload {
  orderId: string;
  orderNumber: string;
  orderItemId?: string | null;
  skuId: string;
  reason: string;
  options: ("REFUND" | "ALTERNATE" | "BACKORDER")[];
}

