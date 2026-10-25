import { OrderStatus, PaymentMode, PaymentStatus, FulfillmentChannel } from "@/modules/orders/schema";
import { SealStatus } from "@/modules/trust/schema";
import { ClaimType, ClaimStatus } from "@/modules/rma/schema";

export interface SeedSealDefinition {
  sealId: string;
  skuCode: string;
  status: SealStatus;
  voidReason?: "PRINTER_JAM" | "RIBBON_TEAR" | "STICKER_DAMAGED";
}

export interface SeedOrderDefinition {
  orderNumber: string;
  customerPhone: string;
  channel: "STOREFRONT_WEB" | "SHOWROOM_POS";
  status: OrderStatus;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  fulfillmentChannel: FulfillmentChannel;
  items: Array<{
    skuCode: string;
    quantity: number;
    unitPricePaisa: number;
    sealId?: string;
  }>;
  subtotalPaisa: number;
  deliveryFeePaisa: number;
  discountPaisa: number;
  paidTotalPaisa: number;
  consignmentNo?: string;
  pickupPin?: string;
  deliveredAt?: Date;
}

export interface SeedRmaClaimDefinition {
  claimNumber: string;
  orderNumber: string;
  sealId: string;
  customerPhone: string;
  claimType: ClaimType;
  status: ClaimStatus;
  issueDescription: string;
  videoUrl?: string;
}

export const SEED_SEALS: SeedSealDefinition[] = [
  { sealId: "NCA-8F2K-9X41", skuCode: "UGR-NX65-BLK", status: "ACTIVE" },
  { sealId: "NCA-4H7M-3B22", skuCode: "SMC-65W-WHT", status: "PRINTED" },
  { sealId: "NCA-9J1L-7K88", skuCode: "BAS-TG100-1M", status: "GENERATED" },
  { sealId: "NCA-2P4V-6R99", skuCode: "NWB-TW100-1M", status: "VOID_PRINT_ERROR", voidReason: "STICKER_DAMAGED" },
];

export const SEED_ORDERS: SeedOrderDefinition[] = [
  {
    orderNumber: "ORD-2026-DELIVERED",
    customerPhone: "+8801811000002",
    channel: "STOREFRONT_WEB",
    status: "DELIVERED",
    paymentMode: "ONLINE_FULL",
    paymentStatus: "PAID",
    fulfillmentChannel: "COURIER",
    items: [
      {
        skuCode: "UGR-NX65-BLK",
        quantity: 1,
        unitPricePaisa: 345000,
        sealId: "NCA-8F2K-9X41",
      },
    ],
    subtotalPaisa: 345000,
    deliveryFeePaisa: 8000,
    discountPaisa: 0,
    paidTotalPaisa: 353000,
    consignmentNo: "STEADFAST-1001",
    deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  },
  {
    orderNumber: "ORD-2026-CONFIRMED",
    customerPhone: "+8801711000001",
    channel: "STOREFRONT_WEB",
    status: "CONFIRMED",
    paymentMode: "COD",
    paymentStatus: "PARTIALLY_PAID", // Advance delivery fee paid
    fulfillmentChannel: "COURIER",
    items: [
      {
        skuCode: "BAS-TG100-1M",
        quantity: 2,
        unitPricePaisa: 85000,
      },
    ],
    subtotalPaisa: 170000,
    deliveryFeePaisa: 8000,
    discountPaisa: 0,
    paidTotalPaisa: 8000,
  },
  {
    orderNumber: "ORD-2026-SOURCING",
    customerPhone: "+8801811000002",
    channel: "STOREFRONT_WEB",
    status: "SOURCING",
    paymentMode: "COD",
    paymentStatus: "PARTIALLY_PAID",
    fulfillmentChannel: "COURIER",
    items: [
      {
        skuCode: "SMC-65W-WHT",
        quantity: 1,
        unitPricePaisa: 165000,
      },
      {
        skuCode: "NWB-TW100-1M",
        quantity: 1,
        unitPricePaisa: 35000,
      },
    ],
    subtotalPaisa: 200000,
    deliveryFeePaisa: 8000,
    discountPaisa: 0,
    paidTotalPaisa: 8000,
  },
  {
    orderNumber: "ORD-2026-PICKUP",
    customerPhone: "+8801911000003",
    channel: "STOREFRONT_WEB",
    status: "READY_FOR_PICKUP",
    paymentMode: "PAY_AT_COUNTER",
    paymentStatus: "UNPAID",
    fulfillmentChannel: "PICKUP",
    items: [
      {
        skuCode: "NWB-EXT-4G",
        quantity: 1,
        unitPricePaisa: 65000,
      },
    ],
    subtotalPaisa: 65000,
    deliveryFeePaisa: 0,
    discountPaisa: 0,
    paidTotalPaisa: 0,
    pickupPin: "4521",
  },
  {
    orderNumber: "ORD-2026-PENDING",
    customerPhone: "+8801711000001",
    channel: "STOREFRONT_WEB",
    status: "PENDING_PAYMENT",
    paymentMode: "ONLINE_FULL",
    paymentStatus: "UNPAID",
    fulfillmentChannel: "COURIER",
    items: [
      {
        skuCode: "ANK-P3-BLU",
        quantity: 1,
        unitPricePaisa: 720000,
      },
    ],
    subtotalPaisa: 720000,
    deliveryFeePaisa: 8000,
    discountPaisa: 0,
    paidTotalPaisa: 0,
  },
];

export const SEED_RMA_CLAIMS: SeedRmaClaimDefinition[] = [
  {
    claimNumber: "RMA-2026-0001",
    orderNumber: "ORD-2026-DELIVERED",
    sealId: "NCA-8F2K-9X41",
    customerPhone: "+8801811000002",
    claimType: "DOA",
    status: "APPROVED",
    issueDescription: "Type-C Port 1 cuts out intermittently when charging 65W laptop under high load.",
    videoUrl: "https://r2.ncamart.com/claims/proof-unboxing-001.mp4",
  },
];
