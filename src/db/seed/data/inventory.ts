import { LocationCode } from "@/modules/inventory/schema";

export interface SeedPhysicalStockDefinition {
  skuCode: string;
  locationCode: LocationCode;
  onHand: number;
  safetyStock: number;
}

export const SEED_PHYSICAL_STOCK: SeedPhysicalStockDefinition[] = [
  // UGREEN Nexode 65W
  { skuCode: "UGR-NX65-BLK", locationCode: "GODOWN_NAWABPUR", onHand: 20, safetyStock: 5 },
  { skuCode: "UGR-NX65-BLK", locationCode: "SHOWROOM_COUNTER", onHand: 5, safetyStock: 2 },

  // SmartChoice 65W GaN
  { skuCode: "SMC-65W-WHT", locationCode: "GODOWN_NAWABPUR", onHand: 40, safetyStock: 10 },
  { skuCode: "SMC-65W-WHT", locationCode: "SHOWROOM_COUNTER", onHand: 10, safetyStock: 3 },

  // Baseus 100W Cable
  { skuCode: "BAS-TG100-1M", locationCode: "GODOWN_NAWABPUR", onHand: 50, safetyStock: 10 },
  { skuCode: "BAS-TG100-1M", locationCode: "SHOWROOM_COUNTER", onHand: 15, safetyStock: 5 },

  // Nawabpur ToughWeave 100W Cable
  { skuCode: "NWB-TW100-1M", locationCode: "GODOWN_NAWABPUR", onHand: 80, safetyStock: 15 },
  { skuCode: "NWB-TW100-1M", locationCode: "SHOWROOM_COUNTER", onHand: 25, safetyStock: 5 },

  // Anker Life P3 ANC Earbuds
  { skuCode: "ANK-P3-BLU", locationCode: "GODOWN_NAWABPUR", onHand: 15, safetyStock: 3 },
  { skuCode: "ANK-P3-BLU", locationCode: "SHOWROOM_COUNTER", onHand: 3, safetyStock: 1 },

  // SmartSound Neo ANC Earbuds
  { skuCode: "SSN-NEO-BLK", locationCode: "GODOWN_NAWABPUR", onHand: 30, safetyStock: 8 },
  { skuCode: "SSN-NEO-BLK", locationCode: "SHOWROOM_COUNTER", onHand: 8, safetyStock: 2 },

  // Nawabpur Heavy Duty Extension Board
  { skuCode: "NWB-EXT-4G", locationCode: "GODOWN_NAWABPUR", onHand: 25, safetyStock: 5 },
  { skuCode: "NWB-EXT-4G", locationCode: "SHOWROOM_COUNTER", onHand: 10, safetyStock: 3 },

  // Baseus Handheld Vacuum
  { skuCode: "BAS-VAC-PRO", locationCode: "GODOWN_NAWABPUR", onHand: 12, safetyStock: 2 },
  { skuCode: "BAS-VAC-PRO", locationCode: "SHOWROOM_COUNTER", onHand: 4, safetyStock: 1 },
];
