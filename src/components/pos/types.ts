export type PosPaymentMethod = "CASH" | "BKASH_QR" | "CARD_TERMINAL" | "STORE_CREDIT";

export interface PosProduct {
  id: string;
  skuId: string;
  skuCode: string;
  barcode: string;
  title: string;
  category: string;
  pricePaisa: number;
  showroomStock: number;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  image: string;
}

export interface PosCartItem {
  product: PosProduct;
  quantity: number;
  assignedSealId?: string;
}

export interface PosCustomer {
  id?: string;
  phone: string;
  name: string;
  loyaltyTier?: string;
  storeCreditPaisa?: number;
  isGuest: boolean;
}

export interface PosSessionInfo {
  counterId: string;
  counterName: string;
  drawerSessionId: string;
  drawerOpenPaisa: number;
  staffName: string;
  staffRole: "SHOWROOM_AGENT" | "SUPER_ADMIN";
  location: string;
}

export interface PosSaleReceipt {
  invoiceNumber: string;
  mushak63Serial: string;
  timestamp: string;
  cashierName: string;
  counterName: string;
  customer: PosCustomer;
  items: PosCartItem[];
  subtotalPaisa: number;
  vatPaisa: number;
  totalPaisa: number;
  tenderedPaisa: number;
  changeDuePaisa: number;
  paymentMethod: PosPaymentMethod;
  paymentRef?: string;
  sealIds: string[];
}
