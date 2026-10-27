export type RunnerTaskStatus =
  | "ASSIGNED"
  | "ACCEPTED"
  | "AT_STALL"
  | "PRICE_OVERRIDE_PENDING"
  | "PURCHASED"
  | "RETURNED_GODOWN";

export interface RunnerTask {
  id: string;
  orderNumber: string;
  marketName: string;
  stallName: string;
  stallNumber: string;
  stallContactPhone: string;
  skuTitle: string;
  skuCode: string;
  quantity: number;
  image: string;
  targetWholesalePricePaisa: number;
  maxAllowedSpotPricePaisa: number;
  negotiatedSpotPricePaisa?: number;
  overrideStatus?: "NONE" | "REQUESTED" | "APPROVED" | "REJECTED";
  status: RunnerTaskStatus;
  assignedAt: string;
  purchasedReceiptUrl?: string;
}

export interface RunnerProfile {
  id: string;
  name: string;
  phone: string;
  role: "FIELD_RUNNER";
  shiftStatus: "ON_SHIFT" | "OFF_SHIFT";
  cashFloatPaisa: number;
  activeTasksCount: number;
}
