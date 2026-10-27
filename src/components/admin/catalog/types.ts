export type ProductTier = "AUTHENTIC" | "BUDGET_SMART";

export type ProductStatus =
  | "DRAFT"
  | "REVIEW_REQUIRED"
  | "ACTIVE"
  | "ARCHIVED";

export interface MediaUploadItem {
  id: string;
  name: string;
  url: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  isPrimary?: boolean;
  sizeBytes?: number;
}

export interface SpecAttribute {
  key: string;
  label: string;
  value: string;
  unit?: string;
  type: "text" | "number" | "select";
  options?: string[];
  required?: boolean;
}

export interface AdminCatalogProduct {
  id: string;
  title: string;
  slug: string;
  skuCode: string;
  tier: ProductTier;
  status: ProductStatus;
  category: string;
  brand: string;
  retailPricePaisa: number;
  wholesaleBaselineCostPaisa: number;
  maxAllowedSpotPricePaisa: number;
  stockCount: number;
  primaryImage: string;
  galleryImages: MediaUploadItem[];
  distributorName?: string;
  distributorCertificateUrl?: string;
  oemTestReportUrl?: string;
  specs: Record<string, string>;
  updatedAt: string;
}
