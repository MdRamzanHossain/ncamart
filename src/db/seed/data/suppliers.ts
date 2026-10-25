import { SupplierMarket, SupplierPaymentMode } from "@/modules/sourcing/schema";

export interface SeedSupplierDefinition {
  name: string;
  proprietorName: string;
  market: SupplierMarket;
  stallNo: string;
  floor: string;
  phone: string;
  bkashMerchantNumber?: string;
  acceptedPaymentModes: SupplierPaymentMode[];
  stockSkus: Array<{
    skuCode: string;
    status: "AVAILABLE" | "LIMITED";
    priority: number;
    dailyOrderCap?: number;
    lastQuotedCostPaisa: number;
  }>;
}

export const SEED_SUPPLIERS: SeedSupplierDefinition[] = [
  {
    name: "M/S Nawabpur Power Hub",
    proprietorName: "Haji Nurul Islam",
    market: "NAWABPUR_COMPLEX",
    stallNo: "Stall 42",
    floor: "Ground Floor",
    phone: "+8801711223344",
    bkashMerchantNumber: "01711223344",
    acceptedPaymentModes: ["CASH", "BKASH"],
    stockSkus: [
      { skuCode: "SMC-65W-WHT", status: "AVAILABLE", priority: 1, dailyOrderCap: 50, lastQuotedCostPaisa: 115000 },
      { skuCode: "NWB-TW100-1M", status: "AVAILABLE", priority: 1, dailyOrderCap: 100, lastQuotedCostPaisa: 21000 },
      { skuCode: "NWB-PC20-BLK", status: "AVAILABLE", priority: 1, dailyOrderCap: 30, lastQuotedCostPaisa: 155000 },
      { skuCode: "NWB-MP6-SLV", status: "AVAILABLE", priority: 1, dailyOrderCap: 25, lastQuotedCostPaisa: 105000 },
    ],
  },
  {
    name: "Haji Tools & Measurement Tech",
    proprietorName: "Md. Mostafa Kamal",
    market: "NAWABPUR_COMPLEX",
    stallNo: "Stall 15",
    floor: "1st Floor",
    phone: "+8801711223345",
    acceptedPaymentModes: ["CASH", "SUPPLIER_CREDIT"],
    stockSkus: [
      { skuCode: "NWB-EXT-4G", status: "AVAILABLE", priority: 1, dailyOrderCap: 40, lastQuotedCostPaisa: 42000 },
      { skuCode: "NWB-WL-COB", status: "AVAILABLE", priority: 1, dailyOrderCap: 60, lastQuotedCostPaisa: 48000 },
      { skuCode: "NWB-OPM-VFL", status: "AVAILABLE", priority: 1, dailyOrderCap: 15, lastQuotedCostPaisa: 135000 },
      { skuCode: "NWB-INV-500W", status: "LIMITED", priority: 1, dailyOrderCap: 10, lastQuotedCostPaisa: 320000 },
    ],
  },
  {
    name: "Sundarban Gadget Zone",
    proprietorName: "Anisur Rahman",
    market: "SUNDARBAN_SQUARE",
    stallNo: "Stall 204",
    floor: "2nd Floor",
    phone: "+8801711223346",
    bkashMerchantNumber: "01711223346",
    acceptedPaymentModes: ["CASH", "BKASH"],
    stockSkus: [
      { skuCode: "NWB-VAC-MINI", status: "AVAILABLE", priority: 1, dailyOrderCap: 20, lastQuotedCostPaisa: 125000 },
      { skuCode: "NWB-TRM-GOLD", status: "AVAILABLE", priority: 1, dailyOrderCap: 35, lastQuotedCostPaisa: 75000 },
      { skuCode: "NWB-BP-BLK", status: "AVAILABLE", priority: 2, dailyOrderCap: 40, lastQuotedCostPaisa: 80000 },
    ],
  },
  {
    name: "Dhaka Stadium Tech Emporium",
    proprietorName: "Shah Alam",
    market: "STADIUM_MARKET",
    stallNo: "Shop 88",
    floor: "1st Floor",
    phone: "+8801711223347",
    acceptedPaymentModes: ["CASH", "BKASH", "SUPPLIER_CREDIT"],
    stockSkus: [
      { skuCode: "UGR-NX65-BLK", status: "AVAILABLE", priority: 1, dailyOrderCap: 25, lastQuotedCostPaisa: 265000 },
      { skuCode: "BAS-GAN5-65W", status: "AVAILABLE", priority: 1, dailyOrderCap: 20, lastQuotedCostPaisa: 245000 },
      { skuCode: "ANK-NANO2-65", status: "AVAILABLE", priority: 1, dailyOrderCap: 15, lastQuotedCostPaisa: 300000 },
      { skuCode: "BAS-TG100-1M", status: "AVAILABLE", priority: 1, dailyOrderCap: 50, lastQuotedCostPaisa: 58000 },
    ],
  },
  {
    name: "Patuatuli Sound Vision",
    proprietorName: "Bishwajit Roy",
    market: "PATUATULI",
    stallNo: "Shop 12",
    floor: "Ground Floor",
    phone: "+8801711223348",
    acceptedPaymentModes: ["CASH", "BKASH"],
    stockSkus: [
      { skuCode: "SSN-NEO-BLK", status: "AVAILABLE", priority: 1, dailyOrderCap: 30, lastQuotedCostPaisa: 150000 },
      { skuCode: "NWB-BP-BLK", status: "AVAILABLE", priority: 1, dailyOrderCap: 50, lastQuotedCostPaisa: 80000 },
      { skuCode: "NWB-BBM-RED", status: "AVAILABLE", priority: 1, dailyOrderCap: 25, lastQuotedCostPaisa: 95000 },
      { skuCode: "ANK-P3-BLU", status: "LIMITED", priority: 1, dailyOrderCap: 10, lastQuotedCostPaisa: 540000 },
    ],
  },
  {
    name: "Global Direct HK Logistics",
    proprietorName: "Kenneth Wong",
    market: "IMPORT",
    stallNo: "Unit 702",
    floor: "Kowloon Gateway Hub",
    phone: "+85291234567",
    acceptedPaymentModes: ["SUPPLIER_CREDIT"],
    stockSkus: [
      { skuCode: "HIK-POCKET-E", status: "AVAILABLE", priority: 1, lastQuotedCostPaisa: 3350000 },
      { skuCode: "HIK-B10-CAM", status: "AVAILABLE", priority: 1, lastQuotedCostPaisa: 5200000 },
      { skuCode: "UNI-UT204P", status: "AVAILABLE", priority: 1, lastQuotedCostPaisa: 490000 },
      { skuCode: "UNI-UT89X", status: "AVAILABLE", priority: 1, lastQuotedCostPaisa: 330000 },
      { skuCode: "AQR-A100-PRO", status: "AVAILABLE", priority: 1, lastQuotedCostPaisa: 2200000 },
      { skuCode: "70M-PS01-BOOST", status: "AVAILABLE", priority: 1, lastQuotedCostPaisa: 590000 },
      { skuCode: "ANK-SOLIX-C1000", status: "AVAILABLE", priority: 1, lastQuotedCostPaisa: 10800000 },
    ],
  },
];
