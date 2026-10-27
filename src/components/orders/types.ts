export type OrderStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "SOURCING"
  | "QC_PASSED"
  | "PACKED"
  | "WITH_COURIER"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED_RTO";

export interface OrderItem {
  id: string;
  titleEn: string;
  titleBn: string;
  brandName: string;
  sku: string;
  quantity: number;
  unitPricePaisa: number;
  totalPaisa: number;
  imageUrl?: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  isStockout?: boolean;
}

export interface DeliveryMilestone {
  stage: number;
  label: string;
  sublabel: string;
  timestamp?: string;
  isCompleted: boolean;
  isCurrent: boolean;
  location?: string;
}

export interface CourierInfo {
  partner: "PATHAO" | "STEADFAST" | "REDX" | "PAPERFLY" | "SHOWROOM_COUNTER";
  consignmentId: string;
  hotline: string;
  trackingUrl?: string;
  riderName?: string;
  riderPhone?: string;
}

export interface ShowroomPickupPin {
  pin: string;
  qrCodeUrl: string;
  expiresAt: string;
  showroomLocation: string;
}

export interface PartialStockoutAlert {
  affectedItemTitle: string;
  affectedItemId: string;
  stallNote: string;
  occurredAt: string;
}

export interface CustomerOrder {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: "SSLCOMMERZ" | "COD" | "STORE_CREDIT" | "COUNTER_CASH";
  paymentStatus: "PAID" | "PENDING_COD" | "REFUNDED";
  totalPaisa: number;
  items: OrderItem[];
  shippingAddress: {
    consigneeName: string;
    contactPhone: string;
    streetAddress: string;
    thana: string;
    district: string;
  };
  courier?: CourierInfo;
  pickupPin?: ShowroomPickupPin;
  partialStockout?: PartialStockoutAlert;
  milestones: DeliveryMilestone[];
  invoicePdfUrl?: string;
}

export function formatPaisaToBDT(paisa: number): string {
  const bdt = (paisa / 100).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `৳${bdt}`;
}
