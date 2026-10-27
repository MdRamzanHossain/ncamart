/**
 * NCAMart — Cart Component Types
 * PRD §3.5, §3.11, architechture.md §4, F14
 */

export interface CartItem {
  id: string;
  productId: string;
  skuId: string;
  slug: string;
  title: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  variantLabel: string;
  pricePaisa: number;
  compareAtPricePaisa?: number | null;
  quantity: number;
  thumbnailUrl: string;
  isReserved?: boolean;
}

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items?: CartItem[];
  onUpdateQuantity?: (id: string, qty: number) => void;
  onRemoveItem?: (id: string) => void;
}
