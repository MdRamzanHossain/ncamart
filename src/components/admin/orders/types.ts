export type AdminOrderStatus =
  | "PENDING_CONFIRMATION"
  | "SOURCING_RUNNER"
  | "AT_GODOWN_QC"
  | "PACKED"
  | "WITH_COURIER"
  | "DELIVERED";

export interface AdminOrderItem {
  skuTitle: string;
  skuCode: string;
  quantity: number;
  unitPricePaisa: number;
}

export interface AdminOrderCardItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhoneMasked: string;
  division: string;
  district: string;
  totalPaisa: number;
  itemCount: number;
  paymentMethod: "SSLCOMMERZ" | "COD" | "STORE_CREDIT";
  paymentStatus: "PAID" | "COD_PENDING";
  tier: "AUTHENTIC" | "BUDGET_SMART";
  status: AdminOrderStatus;
  slaAgeHours: number; // e.g. 1.5, 4.2 (turns red if > 4.0)
  courierPartner?: "Pathao" | "Steadfast" | "Showroom Pickup";
  consignmentId?: string;
  items: AdminOrderItem[];
  createdAt: string;
}

export const VALID_TRANSITIONS: Record<AdminOrderStatus, AdminOrderStatus[]> = {
  PENDING_CONFIRMATION: ["SOURCING_RUNNER"],
  SOURCING_RUNNER: ["AT_GODOWN_QC"],
  AT_GODOWN_QC: ["PACKED"],
  PACKED: ["WITH_COURIER"],
  WITH_COURIER: ["DELIVERED"],
  DELIVERED: [],
};

export const KANBAN_COLUMNS: {
  status: AdminOrderStatus;
  title: string;
  icon: string;
  color: string;
}[] = [
  { status: "PENDING_CONFIRMATION", title: "Pending Confirmation", icon: "⏳", color: "#f59e0b" },
  { status: "SOURCING_RUNNER", title: "Sourcing Runner", icon: "🏃", color: "#38bdf8" },
  { status: "AT_GODOWN_QC", title: "At Godown QC", icon: "🔬", color: "#a855f7" },
  { status: "PACKED", title: "Packed & Staged", icon: "📦", color: "#10b981" },
  { status: "WITH_COURIER", title: "With Courier", icon: "🚚", color: "#6366f1" },
  { status: "DELIVERED", title: "Delivered", icon: "✅", color: "#14b8a6" },
];
