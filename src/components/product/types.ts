/**
 * NCAMart — Product Detail Types
 * PRD §3.1, §3.4, §3.15, F12
 */

import { ProductTier } from "@/modules/catalog/dto";

export interface ProductMediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  kind: "IMAGE" | "VIDEO";
  title?: string;
  videoUrl?: string;
  duration?: string;
}

export interface ProductSkuVariant {
  id: string;
  sku_code: string;
  title_en?: string;
  barcode_ean13?: string | null;
  price_paisa: number;
  compare_at_price_paisa?: number | null;
  attributes: Record<string, string>;
  specs: Array<{
    key: string;
    label_en: string;
    label_bn: string;
    value: unknown;
    unit: string | null;
    is_highlighted?: boolean;
  }>;
  warranty_label: {
    code: string;
    days: number;
    label_en: string;
    label_bn: string;
  };
  availability: {
    status: "IN_STOCK" | "LOW_STOCK" | "PRE_ORDER" | "OUT_OF_STOCK";
    physical_qty: number;
    label_en: string;
    label_bn: string;
  };
}

export interface ProductDetailData {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  product_tier: ProductTier;
  brand: {
    id: string;
    name: string;
    slug: string;
  } | null;
  category: {
    id: string;
    name_en: string;
    name_bn: string;
    slug: string;
  };
  description_en: string;
  description_bn: string;
  origin_country?: string | null;
  vat_rate_bp: number;
  zero_replica_attested: boolean;
  comparison_group_id?: string | null;
  rating: number;
  reviews_count: number;
  media: ProductMediaItem[];
  skus: ProductSkuVariant[];
  preorder_info?: {
    eta_days_min: number | null;
    eta_days_max: number | null;
    deposit_percentage: number;
  } | null;
  key_highlights: string[];
}
