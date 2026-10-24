// Outbox domain event definitions for module: inventory

export interface SkuAvailabilityChangedPayload {
  skuId: string;
  oldStatus?: string;
  newStatus: "IN_STOCK" | "AVAILABLE" | "OUT_OF_STOCK";
}

export interface InventoryMovementPayload {
  movementId: string;
  skuId: string;
  fromLocationCode?: string | null;
  toLocationCode?: string | null;
  qty: number;
  reason: string;
  refType: string;
  refId: string;
}

export interface InventoryReservationPayload {
  reservationId: string;
  orderId: string;
  skuId: string;
  locationCode: string;
  qty: number;
}

export interface InventoryReconciliationMismatchPayload {
  skuId: string;
  locationId: string;
  locationCode: string;
  onHand: number;
  movementNet: number;
  discrepancy: number;
}

export interface InventoryNightlyAuditPayload {
  checkedCombinations: number;
  mismatchesCount: number;
  mismatches: InventoryReconciliationMismatchPayload[];
  auditedAt: string;
}
