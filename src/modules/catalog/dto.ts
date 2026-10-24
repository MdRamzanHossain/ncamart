import { z } from "zod";
import {
  fulfillmentTypeEnum,
  FulfillmentType,
  specFieldTypeEnum,
  SpecFieldType,
  productTierEnum,
  ProductTier,
  btrcStatusEnum,
  BtrcStatus,
  productStatusEnum,
  ProductStatus,
  warrantyTypeEnum,
  WarrantyType,
  CategoryRow,
  ProductRow,
  SkuRow,
  BrandRow,
  ComparisonGroupRow,
} from "./schema";

export {
  fulfillmentTypeEnum,
  specFieldTypeEnum,
  productTierEnum,
  btrcStatusEnum,
  productStatusEnum,
  warrantyTypeEnum,
};

export type {
  CategoryRow,
  ProductRow,
  SkuRow,
  BrandRow,
  ComparisonGroupRow,
  FulfillmentType,
  SpecFieldType,
  ProductTier,
  BtrcStatus,
  ProductStatus,
  WarrantyType,
};


// 1. Category DTOs
export const CreateCategoryDtoSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  nameEn: z.string().min(1).max(255),
  nameBn: z.string().min(1).max(255),
  level: z.number().int().min(1).max(3),
  sortOrder: z.number().int().default(0),
  defaultFulfillmentType: z.enum(fulfillmentTypeEnum).default("DROP_AND_PACK"),
  btrcClearanceRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type CreateCategoryDto = z.input<typeof CreateCategoryDtoSchema>;

export const CategoryDtoSchema = CreateCategoryDtoSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CategoryDto = z.infer<typeof CategoryDtoSchema>;

// 2. Category Spec Field DTOs
export const CreateCategorySpecFieldDtoSchema = z.object({
  categoryId: z.string().uuid(),
  keyName: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "keyName must be snake_case alphanumeric"),
  labelEn: z.string().min(1).max(128),
  labelBn: z.string().min(1).max(128),
  unit: z.string().max(32).nullable().optional(),
  fieldType: z.enum(specFieldTypeEnum),
  enumOptions: z.array(z.string()).nullable().optional(),
  isRequired: z.boolean().default(false),
  isHighlightedForComparison: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export type CreateCategorySpecFieldDto = z.input<typeof CreateCategorySpecFieldDtoSchema>;

export const CategorySpecFieldDtoSchema = CreateCategorySpecFieldDtoSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
});

export type CategorySpecFieldDto = z.infer<typeof CategorySpecFieldDtoSchema>;

// 3. Brand DTOs
export const CreateBrandDtoSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  isAuthorizedDistribution: z.boolean().default(false),
  officialDistributorName: z.string().max(255).nullable().optional(),
});

export type CreateBrandDto = z.input<typeof CreateBrandDtoSchema>;

export const BrandDtoSchema = CreateBrandDtoSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type BrandDto = z.infer<typeof BrandDtoSchema>;

// 4. Comparison Group DTOs
export const CreateComparisonGroupDtoSchema = z.object({
  name: z.string().min(1).max(255),
  categoryId: z.string().uuid(),
  verdictEn: z.string().nullable().optional(),
  verdictBn: z.string().nullable().optional(),
  badgeAuthenticLabel: z.string().default("Full Safety Suite"),
  badgeBudgetLabel: z.string().default("Best Everyday Value"),
});

export type CreateComparisonGroupDto = z.input<typeof CreateComparisonGroupDtoSchema>;

export const ComparisonGroupDtoSchema = CreateComparisonGroupDtoSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ComparisonGroupDto = z.infer<typeof ComparisonGroupDtoSchema>;

// 5. Product DTOs
export const CreateProductDtoSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  titleEn: z.string().min(1).max(255),
  titleBn: z.string().min(1).max(255),
  descriptionEn: z.string().nullable().optional(),
  descriptionBn: z.string().nullable().optional(),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().nullable().optional(),
  productTier: z.enum(productTierEnum),
  fulfillmentType: z.enum(fulfillmentTypeEnum),
  comparisonGroupId: z.string().uuid().nullable().optional(),
  originCountry: z.string().max(64).nullable().optional(),
  hsCode: z.string().max(32).nullable().optional(),
  btrcStatus: z.enum(btrcStatusEnum).default("NOT_REQUIRED"),
  btrcClearanceCode: z.string().max(64).nullable().optional(),
  vatRateBp: z.number().int().min(0).max(10000).default(0), // basis points (500 = 5%)
  zeroReplicaAttested: z.boolean().default(false),
  zeroReplicaAttestedBy: z.string().uuid().nullable().optional(),
  distributorEvidenceMediaId: z.string().uuid().nullable().optional(),
  comparisonPointsEn: z.array(z.string()).nullable().optional(),
  comparisonPointsBn: z.array(z.string()).nullable().optional(),
  seoTitle: z.string().max(255).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  preorderEtaDaysMin: z.number().int().min(1).nullable().optional(),
  preorderEtaDaysMax: z.number().int().min(1).nullable().optional(),
  preorderBatchThreshold: z.number().int().min(1).nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
});

export type CreateProductDto = z.input<typeof CreateProductDtoSchema>;

export const UpdateProductDtoSchema = CreateProductDtoSchema.partial();
export type UpdateProductDto = z.infer<typeof UpdateProductDtoSchema>;

export const ProductDtoSchema = CreateProductDtoSchema.extend({
  id: z.string().uuid(),
  status: z.enum(productStatusEnum),
  submittedBy: z.string().uuid().nullable().optional(),
  reviewedBy: z.string().uuid().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
  publishedAt: z.date().nullable().optional(),
  archivedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProductDto = z.infer<typeof ProductDtoSchema>;

// 6. SKU DTOs
export const CreateSkuDtoSchema = z.object({
  productId: z.string().uuid(),
  skuCode: z
    .string()
    .min(3)
    .max(64)
    .transform((val) => val.toUpperCase()),
  barcodeEan13: z
    .string()
    .regex(/^\d{13}$/, "Barcode must be 13 digits (EAN-13)")
    .nullable()
    .optional(),
  attributes: z.record(z.string(), z.string()).default({}),
  specs: z.record(z.string(), z.unknown()).default({}),
  pricePaisa: z.number().int().positive(), // integer paisa
  compareAtPricePaisa: z.number().int().positive().nullable().optional(),
  baseCostPaisa: z.number().int().positive(),
  spotBufferBp: z.number().int().min(500).max(700).default(600), // 5% to 7%, default 600 bp
  warrantyDays: z.number().int().min(0).default(0),
  warrantyType: z.enum(warrantyTypeEnum),
  officialDistributorName: z.string().max(255).nullable().optional(),
  weightGrams: z.number().int().min(0).default(0),
  dailyOrderCap: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export type CreateSkuDto = z.input<typeof CreateSkuDtoSchema>;

export const SkuDtoSchema = CreateSkuDtoSchema.extend({
  id: z.string().uuid(),
  maxUnitPurchasePaisa: z.number().int().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SkuDto = z.infer<typeof SkuDtoSchema>;

// 7. Product Status Transition
export const TransitionProductStatusDtoSchema = z.object({
  toStatus: z.enum(productStatusEnum),
  actorId: z.string().uuid().optional(),
  actorType: z.enum(["STAFF", "SYSTEM"]).default("STAFF"),
  notes: z.string().optional(),
});

export type TransitionProductStatusDto = z.input<typeof TransitionProductStatusDtoSchema>;

// 8. Create Product with SKUs (Admin Body - api-spec §15.1)
export const SkuInputSchema = z.object({
  skuCode: z
    .string()
    .min(3)
    .max(64)
    .transform((val) => val.toUpperCase()),
  barcodeEan13: z
    .string()
    .regex(/^\d{13}$/, "Barcode must be 13 digits (EAN-13)")
    .nullable()
    .optional(),
  attributes: z.record(z.string(), z.string()).default({}),
  specs: z.record(z.string(), z.unknown()).default({}),
  pricePaisa: z.number().int().positive(),
  compareAtPricePaisa: z.number().int().positive().nullable().optional(),
  baseCostPaisa: z.number().int().positive(),
  spotBufferBp: z.number().int().min(500).max(700).default(600),
  warrantyDays: z.number().int().min(0).default(0),
  warrantyType: z.enum(warrantyTypeEnum),
  officialDistributorName: z.string().max(255).nullable().optional(),
  weightGrams: z.number().int().min(0).default(0),
  dailyOrderCap: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});
export type SkuInput = z.input<typeof SkuInputSchema>;

export const CreateProductWithSkusDtoSchema = CreateProductDtoSchema.extend({
  skus: z.array(SkuInputSchema).default([]),
});
export type CreateProductWithSkusDto = z.input<typeof CreateProductWithSkusDtoSchema>;

// 9. Update SKU (Pricing vs Structural)
export const UpdateSkuDtoSchema = SkuInputSchema.partial();
export type UpdateSkuDto = z.input<typeof UpdateSkuDtoSchema>;

export const UpdateSkuPricingDtoSchema = z.object({
  pricePaisa: z.number().int().positive().optional(),
  compareAtPricePaisa: z.number().int().positive().nullable().optional(),
  baseCostPaisa: z.number().int().positive().optional(),
  spotBufferBp: z.number().int().min(500).max(700).optional(),
  dailyOrderCap: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSkuPricingDto = z.input<typeof UpdateSkuPricingDtoSchema>;

// 10. Image Upload URL
export const ProductImageUploadUrlDtoSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024, "Image size cannot exceed 10 MB"),
  kind: z
    .enum(["PRODUCT_IMAGE", "DISTRIBUTOR_EVIDENCE"])
    .default("PRODUCT_IMAGE"),
});
export type ProductImageUploadUrlDto = z.input<typeof ProductImageUploadUrlDtoSchema>;

// 11. Product List Filter
export const ProductListFilterDtoSchema = z.object({
  status: z.enum(productStatusEnum).optional(),
  tier: z.enum(productTierEnum).optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ProductListFilterDto = z.input<typeof ProductListFilterDtoSchema>;

// 12. Public Catalog DTOs (P11)
export const PublicProductFilterDtoSchema = z.object({
  category: z.string().optional(), // category slug
  tier: z.enum(productTierEnum).optional(),
  brand: z.string().optional(), // brand slug
  fulfillment: z.enum(["REGULAR_DROP_PACK", "PRE_ORDER"]).optional(),
  price_min_paisa: z.coerce.number().int().min(0).optional(),
  price_max_paisa: z.coerce.number().int().min(0).optional(),
  availability: z.enum(["IN_STOCK", "AVAILABLE", "ANY"]).default("ANY"),
  sort: z.enum(["PRICE_ASC", "PRICE_DESC", "NEWEST"]).default("NEWEST"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PublicProductFilterDto = z.input<typeof PublicProductFilterDtoSchema>;

export interface PublicCategoryTreeNode {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string;
  level: number;
  sort_order: number;
  published_product_count: number;
  children: PublicCategoryTreeNode[];
}

export interface PublicTierBadge {
  code: ProductTier;
  label_en: string;
  label_bn: string;
}

export interface PublicAvailabilityBadge {
  code: string;
  label_en: string;
  label_bn: string;
}

export interface PublicProductListItem {
  id: string;
  title_en: string;
  title_bn: string;
  slug: string;
  product_tier: ProductTier;
  brand_name: string | null;
  min_regular_price_paisa: number;
  min_sale_price_paisa: number;
  primary_image_url: string | null;
  comparison_group_id: string | null;
  tier_badge: PublicTierBadge;
  availability_label: PublicAvailabilityBadge;
}

export interface PublicSkuSpecItem {
  key: string;
  label_en: string;
  label_bn: string;
  value: unknown;
  unit: string | null;
  is_highlighted: boolean;
}

export interface PublicSkuDetail {
  id: string;
  sku_code: string;
  barcode_ean13: string | null;
  price_paisa: number;
  compare_at_price_paisa: number | null;
  attributes: Record<string, string>;
  specs: PublicSkuSpecItem[];
  warranty_label: {
    code: WarrantyType;
    days: number;
    label_en: string;
    label_bn: string;
  };
  availability: {
    status: string;
    physical_qty: number;
    label_en: string;
    label_bn: string;
  };
}

export interface PublicProductDetail {
  id: string;
  title_en: string;
  title_bn: string;
  slug: string;
  product_tier: ProductTier;
  tier_badge: PublicTierBadge;
  description_en: string | null;
  description_bn: string | null;
  fulfillment_type: FulfillmentType;
  origin_country: string | null;
  vat_rate_bp: number;
  zero_replica_attested: boolean;
  comparison_group_id: string | null;
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
  skus: PublicSkuDetail[];
  media: Array<{
    id: string;
    url: string;
    kind: string;
    content_type: string;
  }>;
  preorder_info: {
    eta_days_min: number | null;
    eta_days_max: number | null;
    deposit_preview_paisa: null; // TODO(P15)
  } | null;
  comparison_points_en: string[] | null;
  comparison_points_bn: string[] | null;
  seo: {
    title: string | null;
    description: string | null;
  };
  json_ld: Record<string, unknown>;
}

export interface PublicComparisonItem {
  id: string;
  title_en: string;
  title_bn: string;
  slug: string;
  price_paisa: number;
  warranty_label: string;
  badge_label: string;
  specs: Record<string, unknown>;
}

export interface PublicComparisonDiffItem {
  key: string;
  label_en: string;
  label_bn: string;
  unit: string | null;
  authentic_value: unknown;
  budget_smart_value: unknown;
}

export interface PublicComparisonView {
  comparison_group_id: string;
  name: string;
  authentic_item: PublicComparisonItem | null;
  budget_smart_item: PublicComparisonItem | null;
  spec_diff: PublicComparisonDiffItem[];
  comparison_verdict: {
    summary_en: string | null;
    summary_bn: string | null;
  };
}

