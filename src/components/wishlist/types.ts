export interface WishlistItem {
  id: string;
  productId: string;
  skuId: string;
  slug: string;
  title: string;
  category: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  regularPricePaisa: number;
  currentPricePaisa: number;
  originalPricePaisa?: number;
  image: string;
  availability: "IN_STOCK" | "LOW_STOCK" | "PRE_ORDER" | "OUT_OF_STOCK";
  priceDropAlert: boolean;
  stockAlert: boolean;
  lastPriceDropPaisa?: number;
  addedAt: string;
}

export interface WishlistSummary {
  totalItems: number;
  inStockItems: number;
  activePriceAlerts: number;
  activeStockAlerts: number;
}
