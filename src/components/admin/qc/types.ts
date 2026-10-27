export type QcItemStatus =
  | "PENDING_INSPECTION"
  | "APPROVED"
  | "DEFECTIVE_REJECTED";

export type VoidReason =
  | "PRINTER_JAM"
  | "RIBBON_TEAR"
  | "STICKER_DAMAGED"
  | "MISPRINTED_BARCODE";

export interface QcChecklist {
  housing: boolean;
  cableIntegrity: boolean;
  voltageWattage: boolean;
  packaging: boolean;
}

export interface QcInspectionItem {
  id: string;
  orderNumber: string;
  skuTitle: string;
  skuCode: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  quantity: number;
  stallName: string;
  marketName: string;
  runnerName: string;
  voucherMemoNumber: string;
  status: QcItemStatus;
  checklist: QcChecklist;
  sealId?: string;
  serialNumber?: string;
  defectReason?: string;
  inspectedAt?: string;
}

export interface VoidedSealLog {
  id: string;
  sealId: string;
  reason: VoidReason;
  voidedBy: string;
  voidedAt: string;
  notes?: string;
}
