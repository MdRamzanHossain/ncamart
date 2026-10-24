import crypto from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categories,
  categorySpecFields,
  brands,
  comparisonGroups,
  products,
  skus,
  productStatusHistory,
  CategoryRow,
  InsertCategoryRow,
  CategorySpecFieldRow,
  InsertCategorySpecFieldRow,
  BrandRow,
  InsertBrandRow,
  ComparisonGroupRow,
  InsertComparisonGroupRow,
  ProductRow,
  InsertProductRow,
  SkuRow,
  InsertSkuRow,
  ProductStatusHistoryRow,
  InsertProductStatusHistoryRow,
  ProductStatus,
} from "./schema";
import {
  CreateCategoryDto,
  CreateCategorySpecFieldDto,
  CreateBrandDto,
  CreateComparisonGroupDto,
  CreateProductDto,
  UpdateProductDto,
  CreateSkuDto,
  TransitionProductStatusDto,
  CreateProductWithSkusDto,
  UpdateSkuDto,
  ProductImageUploadUrlDto,
  ProductListFilterDto,
  PublicProductFilterDto,
  PublicCategoryTreeNode,
  PublicProductListItem,
  PublicProductDetail,
  PublicComparisonView,
  PublicComparisonItem,
  PublicComparisonDiffItem,
  PublicSkuDetail,
  PublicSkuSpecItem,
  WarrantyType,
} from "./dto";
import { CATALOG_SEED_TEMPLATES } from "./seed";
import { assertCanTransitionProductStatus } from "./transitions";
import { validateReviewChecklist } from "./checklist";
import { ValidationError, BusinessError, NotFoundError } from "@/lib/errors";
import { mediaService, MediaAssetDto } from "@/modules/media";
import { auditService } from "@/modules/audit";
import { emitOutbox } from "@/lib/outbox";
import { Actor } from "@/lib/http/route";
import {
  availabilityService,
  formatAvailabilityLabel,
  AvailabilityStatus,
} from "./availability";
import {
  catalogCache,
  hashQueryKey,
  clearMemoryCatalogCacheForTesting,
} from "./cache";

// In-Memory Fallback Stores for Isolated Testing & Offline Dev
const memCategories = new Map<string, CategoryRow>();
const memCategorySpecFields = new Map<string, CategorySpecFieldRow>();
const memBrands = new Map<string, BrandRow>();
const memComparisonGroups = new Map<string, ComparisonGroupRow>();
const memProducts = new Map<string, ProductRow>();
const memSkus = new Map<string, SkuRow>();
const memStatusHistory: ProductStatusHistoryRow[] = [];

/**
 * Builds a dynamic Zod validator for a set of category specification fields.
 */
export function buildDynamicSpecSchema(
  fields: CategorySpecFieldRow[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let fieldSchema: z.ZodTypeAny;

    switch (field.fieldType) {
      case "NUMBER":
        fieldSchema = z.coerce.number({
          invalid_type_error: `${field.labelEn} must be a number`,
          required_error: `${field.labelEn} is required`,
        });
        break;
      case "STRING":
        fieldSchema = z.string({
          invalid_type_error: `${field.labelEn} must be a string`,
          required_error: `${field.labelEn} is required`,
        }).min(1, `${field.labelEn} cannot be empty`);
        break;
      case "BOOLEAN":
        fieldSchema = z.boolean({
          invalid_type_error: `${field.labelEn} must be a boolean`,
          required_error: `${field.labelEn} is required`,
        });
        break;
      case "ENUM":
        if (field.enumOptions && field.enumOptions.length > 0) {
          const [first, ...rest] = field.enumOptions;
          fieldSchema = z.enum([first, ...rest] as [string, ...string[]], {
            invalid_type_error: `Invalid option for ${field.labelEn}`,
            required_error: `${field.labelEn} is required`,
          });
        } else {
          fieldSchema = z.string();
        }
        break;
      default:
        fieldSchema = z.any();
    }

    if (!field.isRequired) {
      fieldSchema = fieldSchema.nullable().optional();
    }

    shape[field.keyName] = fieldSchema;
  }

  return z.object(shape).passthrough();
}

export function formatWarrantyLabel(
  type: WarrantyType,
  days: number
): { label_en: string; label_bn: string } {
  if (type === "OFFICIAL_DISTRIBUTOR") {
    if (days >= 365) {
      const yrs = Math.round(days / 365);
      return {
        label_en: `${yrs}-Year Official Replacement`,
        label_bn: `${yrs} বছরের অফিশিয়াল রিপ্লেসমেন্ট ওয়ারেন্টি`,
      };
    }
    return {
      label_en: `${days}-Day Official Replacement`,
      label_bn: `${days} দিনের অফিশিয়াল রিপ্লেসমেন্ট ওয়ারেন্টি`,
    };
  }

  if (type === "SHOP_REPLACEMENT") {
    return {
      label_en: `${days}-Day NCAMart Shop Replacement`,
      label_bn: `${days} দিনের দোকান রিপ্লেসমেন্ট ওয়ারেন্টি`,
    };
  }

  // MANUFACTURER_GLOBAL
  if (days >= 365) {
    const yrs = Math.round(days / 365);
    return {
      label_en: `${yrs}-Year Manufacturer Warranty`,
      label_bn: `${yrs} বছরের প্রস্তুতকারক ওয়ারেন্টি`,
    };
  }
  return {
    label_en: `${days}-Day Manufacturer Warranty`,
    label_bn: `${days} দিনের প্রস্তুতকারক ওয়ারেন্টি`,
  };
}

export const catalogService = {
  healthCheck: async () => ({ module: "catalog", status: "ok" }),

  clearMemoryCatalogForTesting() {
    memCategories.clear();
    memCategorySpecFields.clear();
    memBrands.clear();
    memComparisonGroups.clear();
    memProducts.clear();
    memSkus.clear();
    memStatusHistory.length = 0;
    clearMemoryCatalogCacheForTesting();
    availabilityService.clearMockSkuAvailability();
  },

  setProductStatusForTesting(id: string, status: ProductStatus) {
    const p = memProducts.get(id);
    if (p) {
      p.status = status;
    }
  },

  setSkuForTesting(
    sku: Partial<SkuRow> & { id: string },
    product?: Partial<ProductRow> & { id: string }
  ) {
    const productId = sku.productId ?? product?.id ?? `prod-${sku.id}`;
    const fullSku: SkuRow = {
      id: sku.id,
      productId,
      skuCode: sku.skuCode ?? `SKU-${sku.id}`,
      barcodeEan13: sku.barcodeEan13 ?? null,
      attributes: sku.attributes ?? {},
      specs: sku.specs ?? {},
      pricePaisa: sku.pricePaisa ?? 100_000,
      compareAtPricePaisa: sku.compareAtPricePaisa ?? null,
      baseCostPaisa: sku.baseCostPaisa ?? 80_000,
      spotBufferBp: sku.spotBufferBp ?? 600,
      maxUnitPurchasePaisa: sku.maxUnitPurchasePaisa ?? 84_800,
      warrantyDays: sku.warrantyDays ?? 365,
      warrantyType: sku.warrantyType ?? "OFFICIAL_DISTRIBUTOR",
      warrantyPolicyEn: sku.warrantyPolicyEn ?? null,
      warrantyPolicyBn: sku.warrantyPolicyBn ?? null,
      published: sku.published ?? true,
      publishedAt: sku.publishedAt ?? new Date(),
      unpublishedAt: sku.unpublishedAt ?? null,
      weightGrams: sku.weightGrams ?? 500,
      requiresSerialScan: sku.requiresSerialScan ?? false,
      isBundle: sku.isBundle ?? false,
      bundleItems: sku.bundleItems ?? null,
      deletedAt: sku.deletedAt ?? null,
      createdAt: sku.createdAt ?? new Date(),
      updatedAt: sku.updatedAt ?? new Date(),
    };
    memSkus.set(fullSku.id, fullSku);

    const fullProd: ProductRow = {
      id: productId,
      categoryId: product?.categoryId ?? "cat-default",
      brandId: product?.brandId ?? null,
      titleEn: product?.titleEn ?? "Test Product",
      titleBn: product?.titleBn ?? "টেস্ট প্রোডাক্ট",
      slug: product?.slug ?? `prod-${productId}`,
      productTier: product?.productTier ?? "BUDGET_SMART",
      fulfillmentType: product?.fulfillmentType ?? "DROP_AND_PACK",
      vatRateBp: product?.vatRateBp ?? 0,
      status: product?.status ?? "PUBLISHED",
      statusReason: null,
      statusChangedAt: new Date(),
      statusChangedBy: null,
      reviewNotes: null,
      primaryImageId: null,
      galleryImageIds: [],
      descriptionEn: null,
      descriptionBn: null,
      packageWeightGrams: 500,
      packageDimensions: null,
      hscode: null,
      countryOfOrigin: null,
      customAttributes: {},
      searchKeywords: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memProducts.set(fullProd.id, fullProd);
  },

  // ----------------------------------------------------
  // Seed Catalog Templates
  // ----------------------------------------------------
  async seedTemplates(): Promise<{ categoriesSeeded: number; fieldsSeeded: number }> {
    let catCount = 0;
    let fieldCount = 0;

    for (const def of CATALOG_SEED_TEMPLATES) {
      let cat = await this.getCategoryBySlug(def.category.slug);
      if (!cat) {
        cat = await this.createCategory(def.category as CreateCategoryDto);
        catCount++;
      }

      for (const f of def.specFields) {
        const existingFields = await this.getCategorySpecFields(cat.id);
        const alreadyExists = existingFields.some((ef) => ef.keyName === f.keyName);
        if (!alreadyExists) {
          await this.createCategorySpecField({
            ...f,
            categoryId: cat.id,
          });
          fieldCount++;
        }
      }
    }

    return { categoriesSeeded: catCount, fieldsSeeded: fieldCount };
  },

  // ----------------------------------------------------
  // Categories
  // ----------------------------------------------------
  async createCategory(input: CreateCategoryDto, actor?: Actor): Promise<CategoryRow> {
    const existing = await this.getCategoryBySlug(input.slug);
    if (existing) {
      throw new BusinessError(
        "ERR_SLUG_ALREADY_EXISTS",
        `Category with slug '${input.slug}' already exists`
      );
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const row: CategoryRow = {
      id,
      parentId: input.parentId ?? null,
      slug: input.slug,
      nameEn: input.nameEn,
      nameBn: input.nameBn,
      level: input.level,
      sortOrder: input.sortOrder ?? 0,
      defaultFulfillmentType: input.defaultFulfillmentType ?? "DROP_AND_PACK",
      btrcClearanceRequired: input.btrcClearanceRequired ?? false,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.insert(categories).values(row as InsertCategoryRow);
    } catch {
      // In-memory fallback
    }
    memCategories.set(id, row);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.category_created",
        entityType: "category",
        entityId: id,
        beforeState: null,
        afterState: row,
      });
    } catch {
      // Audit failure non-blocking in mock mode
    }

    return row;
  },

  async updateCategory(
    id: string,
    input: Partial<CreateCategoryDto>,
    actor?: Actor
  ): Promise<CategoryRow> {
    const category = await this.getCategoryById(id);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    if (input.slug && input.slug !== category.slug) {
      const existing = await this.getCategoryBySlug(input.slug);
      if (existing) {
        throw new BusinessError(
          "ERR_SLUG_ALREADY_EXISTS",
          `Category with slug '${input.slug}' already exists`
        );
      }
    }

    const now = new Date();
    const updated: CategoryRow = {
      ...category,
      ...input,
      updatedAt: now,
    };

    try {
      await db.update(categories).set(updated).where(eq(categories.id, id));
    } catch {
      // Fallback
    }
    memCategories.set(id, updated);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.category_updated",
        entityType: "category",
        entityId: id,
        beforeState: category,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    return updated;
  },

  async deleteCategory(id: string, actor?: Actor): Promise<void> {
    const category = await this.getCategoryById(id);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    try {
      await db.delete(categories).where(eq(categories.id, id));
    } catch {
      // Fallback
    }
    memCategories.delete(id);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.category_deleted",
        entityType: "category",
        entityId: id,
        beforeState: category,
        afterState: null,
      });
    } catch {
      // Fallback
    }
  },

  async getCategoryById(id: string): Promise<CategoryRow | null> {
    try {
      const rows = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    return memCategories.get(id) ?? null;
  },

  async getCategoryBySlug(slug: string): Promise<CategoryRow | null> {
    try {
      const rows = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    for (const cat of memCategories.values()) {
      if (cat.slug === slug) return cat;
    }
    return null;
  },

  async listCategories(): Promise<CategoryRow[]> {
    try {
      const rows = await db.select().from(categories);
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return Array.from(memCategories.values());
  },

  // ----------------------------------------------------
  // Category Spec Fields
  // ----------------------------------------------------
  async createCategorySpecField(
    input: CreateCategorySpecFieldDto,
    actor?: Actor
  ): Promise<CategorySpecFieldRow> {
    const category = await this.getCategoryById(input.categoryId);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const row: CategorySpecFieldRow = {
      id,
      categoryId: input.categoryId,
      keyName: input.keyName,
      labelEn: input.labelEn,
      labelBn: input.labelBn,
      unit: input.unit ?? null,
      fieldType: input.fieldType,
      enumOptions: input.enumOptions ?? null,
      isRequired: input.isRequired ?? false,
      isHighlightedForComparison: input.isHighlightedForComparison ?? false,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
    };

    try {
      await db.insert(categorySpecFields).values(row as InsertCategorySpecFieldRow);
    } catch {
      // In-memory fallback
    }
    memCategorySpecFields.set(id, row);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.spec_field_created",
        entityType: "category_spec_field",
        entityId: id,
        beforeState: null,
        afterState: row,
      });
    } catch {
      // Fallback
    }

    return row;
  },

  async updateCategorySpecField(
    fieldId: string,
    input: Partial<CreateCategorySpecFieldDto>,
    actor?: Actor
  ): Promise<CategorySpecFieldRow> {
    const field = memCategorySpecFields.get(fieldId);
    if (!field) {
      throw new NotFoundError("Spec field not found");
    }

    const updated: CategorySpecFieldRow = {
      ...field,
      ...input,
    };

    try {
      await db.update(categorySpecFields).set(updated).where(eq(categorySpecFields.id, fieldId));
    } catch {
      // Fallback
    }
    memCategorySpecFields.set(fieldId, updated);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.spec_field_updated",
        entityType: "category_spec_field",
        entityId: fieldId,
        beforeState: field,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    return updated;
  },

  async deleteCategorySpecField(fieldId: string, actor?: Actor): Promise<void> {
    const field = memCategorySpecFields.get(fieldId);
    if (!field) {
      throw new NotFoundError("Spec field not found");
    }

    try {
      await db.delete(categorySpecFields).where(eq(categorySpecFields.id, fieldId));
    } catch {
      // Fallback
    }
    memCategorySpecFields.delete(fieldId);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.spec_field_deleted",
        entityType: "category_spec_field",
        entityId: fieldId,
        beforeState: field,
        afterState: null,
      });
    } catch {
      // Fallback
    }
  },

  async getCategorySpecFields(categoryId: string): Promise<CategorySpecFieldRow[]> {
    try {
      const rows = await db
        .select()
        .from(categorySpecFields)
        .where(eq(categorySpecFields.categoryId, categoryId));
      if (rows.length > 0) {
        return rows.sort((a, b) => a.sortOrder - b.sortOrder);
      }
    } catch {
      // Fallback
    }

    return Array.from(memCategorySpecFields.values())
      .filter((f) => f.categoryId === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  // ----------------------------------------------------
  // Brands
  // ----------------------------------------------------
  async createBrand(input: CreateBrandDto, actor?: Actor): Promise<BrandRow> {
    const existing = await this.getBrandBySlug(input.slug);
    if (existing) {
      throw new BusinessError(
        "ERR_SLUG_ALREADY_EXISTS",
        `Brand with slug '${input.slug}' already exists`
      );
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const row: BrandRow = {
      id,
      name: input.name,
      slug: input.slug,
      isAuthorizedDistribution: input.isAuthorizedDistribution ?? false,
      officialDistributorName: input.officialDistributorName ?? null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.insert(brands).values(row as InsertBrandRow);
    } catch {
      // In-memory fallback
    }
    memBrands.set(id, row);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.brand_created",
        entityType: "brand",
        entityId: id,
        beforeState: null,
        afterState: row,
      });
    } catch {
      // Fallback
    }

    return row;
  },

  async updateBrand(
    id: string,
    input: Partial<CreateBrandDto>,
    actor?: Actor
  ): Promise<BrandRow> {
    const brand = await this.getBrandById(id);
    if (!brand) {
      throw new NotFoundError("Brand not found");
    }

    if (input.slug && input.slug !== brand.slug) {
      const existing = await this.getBrandBySlug(input.slug);
      if (existing) {
        throw new BusinessError(
          "ERR_SLUG_ALREADY_EXISTS",
          `Brand with slug '${input.slug}' already exists`
        );
      }
    }

    const now = new Date();
    const updated: BrandRow = {
      ...brand,
      ...input,
      updatedAt: now,
    };

    try {
      await db.update(brands).set(updated).where(eq(brands.id, id));
    } catch {
      // Fallback
    }
    memBrands.set(id, updated);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.brand_updated",
        entityType: "brand",
        entityId: id,
        beforeState: brand,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    return updated;
  },

  async deleteBrand(id: string, actor?: Actor): Promise<void> {
    const brand = await this.getBrandById(id);
    if (!brand) {
      throw new NotFoundError("Brand not found");
    }

    try {
      await db.delete(brands).where(eq(brands.id, id));
    } catch {
      // Fallback
    }
    memBrands.delete(id);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.brand_deleted",
        entityType: "brand",
        entityId: id,
        beforeState: brand,
        afterState: null,
      });
    } catch {
      // Fallback
    }
  },

  async getBrandById(id: string): Promise<BrandRow | null> {
    try {
      const rows = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    return memBrands.get(id) ?? null;
  },

  async getBrandBySlug(slug: string): Promise<BrandRow | null> {
    try {
      const rows = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    for (const b of memBrands.values()) {
      if (b.slug === slug) return b;
    }
    return null;
  },

  async listBrands(): Promise<BrandRow[]> {
    try {
      const rows = await db.select().from(brands);
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return Array.from(memBrands.values());
  },

  // ----------------------------------------------------
  // Comparison Groups
  // ----------------------------------------------------
  async createComparisonGroup(
    input: CreateComparisonGroupDto,
    actor?: Actor
  ): Promise<ComparisonGroupRow> {
    const category = await this.getCategoryById(input.categoryId);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const row: ComparisonGroupRow = {
      id,
      name: input.name,
      categoryId: input.categoryId,
      verdictEn: input.verdictEn ?? null,
      verdictBn: input.verdictBn ?? null,
      badgeAuthenticLabel: input.badgeAuthenticLabel ?? "Full Safety Suite",
      badgeBudgetLabel: input.badgeBudgetLabel ?? "Best Everyday Value",
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.insert(comparisonGroups).values(row as InsertComparisonGroupRow);
    } catch {
      // In-memory fallback
    }
    memComparisonGroups.set(id, row);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.comparison_group_created",
        entityType: "comparison_group",
        entityId: id,
        beforeState: null,
        afterState: row,
      });
    } catch {
      // Fallback
    }

    return row;
  },

  async updateComparisonGroup(
    id: string,
    input: Partial<CreateComparisonGroupDto>,
    actor?: Actor
  ): Promise<ComparisonGroupRow> {
    const group = await this.getComparisonGroupById(id);
    if (!group) {
      throw new NotFoundError("Comparison group not found");
    }

    const now = new Date();
    const updated: ComparisonGroupRow = {
      ...group,
      ...input,
      updatedAt: now,
    };

    try {
      await db.update(comparisonGroups).set(updated).where(eq(comparisonGroups.id, id));
    } catch {
      // Fallback
    }
    memComparisonGroups.set(id, updated);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.comparison_group_updated",
        entityType: "comparison_group",
        entityId: id,
        beforeState: group,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    return updated;
  },

  async deleteComparisonGroup(id: string, actor?: Actor): Promise<void> {
    const group = await this.getComparisonGroupById(id);
    if (!group) {
      throw new NotFoundError("Comparison group not found");
    }

    try {
      await db.delete(comparisonGroups).where(eq(comparisonGroups.id, id));
    } catch {
      // Fallback
    }
    memComparisonGroups.delete(id);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.comparison_group_deleted",
        entityType: "comparison_group",
        entityId: id,
        beforeState: group,
        afterState: null,
      });
    } catch {
      // Fallback
    }
  },

  async getComparisonGroupById(id: string): Promise<ComparisonGroupRow | null> {
    try {
      const rows = await db
        .select()
        .from(comparisonGroups)
        .where(eq(comparisonGroups.id, id))
        .limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    return memComparisonGroups.get(id) ?? null;
  },

  async listComparisonGroups(): Promise<ComparisonGroupRow[]> {
    try {
      const rows = await db.select().from(comparisonGroups);
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return Array.from(memComparisonGroups.values());
  },

  // ----------------------------------------------------
  // Products
  // ----------------------------------------------------
  async createProduct(input: CreateProductDto, actor?: Actor): Promise<ProductRow> {
    const existing = await this.getProductBySlug(input.slug);
    if (existing) {
      throw new BusinessError(
        "ERR_SLUG_ALREADY_EXISTS",
        `Product with slug '${input.slug}' already exists`
      );
    }

    const category = await this.getCategoryById(input.categoryId);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const creatorId = actor?.id ?? input.createdBy ?? null;

    const row: ProductRow = {
      id,
      slug: input.slug,
      titleEn: input.titleEn,
      titleBn: input.titleBn,
      descriptionEn: input.descriptionEn ?? null,
      descriptionBn: input.descriptionBn ?? null,
      categoryId: input.categoryId,
      brandId: input.brandId ?? null,
      productTier: input.productTier,
      fulfillmentType: input.fulfillmentType,
      comparisonGroupId: input.comparisonGroupId ?? null,
      originCountry: input.originCountry ?? null,
      hsCode: input.hsCode ?? null,
      btrcStatus: input.btrcStatus ?? "NOT_REQUIRED",
      btrcClearanceCode: input.btrcClearanceCode ?? null,
      vatRateBp: input.vatRateBp ?? 0,
      status: "DRAFT",
      zeroReplicaAttested: input.zeroReplicaAttested ?? false,
      zeroReplicaAttestedBy: input.zeroReplicaAttestedBy ?? null,
      distributorEvidenceMediaId: input.distributorEvidenceMediaId ?? null,
      comparisonPointsEn: input.comparisonPointsEn ?? null,
      comparisonPointsBn: input.comparisonPointsBn ?? null,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      preorderEtaDaysMin: input.preorderEtaDaysMin ?? null,
      preorderEtaDaysMax: input.preorderEtaDaysMax ?? null,
      preorderBatchThreshold: input.preorderBatchThreshold ?? null,
      createdBy: creatorId,
      submittedBy: null,
      reviewedBy: null,
      reviewNotes: null,
      publishedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.insert(products).values(row as InsertProductRow);
    } catch {
      // In-memory fallback
    }
    memProducts.set(id, row);

    // Initial status history entry
    const historyRow: ProductStatusHistoryRow = {
      id: BigInt(memStatusHistory.length + 1),
      productId: id,
      fromStatus: null,
      toStatus: "DRAFT",
      actorId: creatorId,
      actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
      notes: "Product draft created",
      createdAt: now,
    };

    try {
      await db
        .insert(productStatusHistory)
        .values(historyRow as InsertProductStatusHistoryRow);
    } catch {
      // In-memory fallback
    }
    memStatusHistory.push(historyRow);

    try {
      await auditService.record(undefined, {
        staffId: creatorId,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.product_draft_created",
        entityType: "product",
        entityId: id,
        beforeState: null,
        afterState: row,
      });
    } catch {
      // Fallback
    }

    return row;
  },

  /**
   * Creates a draft product together with initial SKUs (as per api-spec §15.1 body).
   */
  async createDraftProductWithSkus(
    input: CreateProductWithSkusDto,
    actor?: Actor
  ): Promise<{ product: ProductRow; skus: SkuRow[] }> {
    const { skus: skuInputs, ...productInput } = input;

    const product = await this.createProduct(productInput, actor);
    const createdSkus: SkuRow[] = [];

    if (skuInputs && skuInputs.length > 0) {
      for (const skuIn of skuInputs) {
        const sku = await this.createSku(
          {
            ...skuIn,
            productId: product.id,
          },
          actor
        );
        createdSkus.push(sku);
      }
    }

    return { product, skus: createdSkus };
  },

  async getProductById(id: string): Promise<ProductRow | null> {
    try {
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.id, id))
        .limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    return memProducts.get(id) ?? null;
  },

  async getProductBySlug(slug: string): Promise<ProductRow | null> {
    try {
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.slug, slug))
        .limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    for (const p of memProducts.values()) {
      if (p.slug === slug) return p;
    }
    return null;
  },

  async updateProduct(
    id: string,
    input: UpdateProductDto,
    actor?: Actor
  ): Promise<ProductRow> {
    const product = await this.getProductById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    // When published, structural edits are strictly disallowed.
    if (product.status === "PUBLISHED") {
      const structuralFields: (keyof UpdateProductDto)[] = [
        "slug",
        "titleEn",
        "titleBn",
        "categoryId",
        "brandId",
        "productTier",
        "fulfillmentType",
        "originCountry",
        "hsCode",
      ];

      for (const field of structuralFields) {
        if (input[field] !== undefined && input[field] !== product[field as keyof ProductRow]) {
          throw new BusinessError(
            "ERR_PRODUCT_IMMUTABLE",
            `Structural edits to published products (field '${String(field)}') require moving back to DRAFT for re-review`
          );
        }
      }
    }

    if (input.slug && input.slug !== product.slug) {
      const existing = await this.getProductBySlug(input.slug);
      if (existing) {
        throw new BusinessError(
          "ERR_SLUG_ALREADY_EXISTS",
          `Product with slug '${input.slug}' already exists`
        );
      }
    }

    const now = new Date();
    const updated: ProductRow = {
      ...product,
      ...input,
      updatedAt: now,
    };

    try {
      await db.update(products).set(updated).where(eq(products.id, id));
    } catch {
      // Fallback
    }
    memProducts.set(id, updated);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.product_updated",
        entityType: "product",
        entityId: id,
        beforeState: product,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    await catalogCache.invalidateProduct(product.slug);
    if (updated.slug !== product.slug) {
      await catalogCache.invalidateProduct(updated.slug);
    }

    if (updated.status === "PUBLISHED") {
      try {
        await emitOutbox(undefined, {
          aggregateType: "product",
          aggregateId: id,
          type: "catalog.product_updated",
          payload: {
            productId: updated.id,
            slug: updated.slug,
            productTier: updated.productTier,
            updatedAt: now.toISOString(),
          },
        });
      } catch {
        // Fallback
      }
    }

    return updated;
  },

  /**
   * Submits a DRAFT or REJECTED product for review, running PRD §3.15.2 checklist.
   */
  async submitProductForReview(
    productId: string,
    actor: Actor
  ): Promise<{ product: ProductRow; warnings: string[] }> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    assertCanTransitionProductStatus(product.status, "PENDING_REVIEW");

    const category = await this.getCategoryById(product.categoryId);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    const skus = await this.listSkusByProductId(productId);

    // Run PRD §3.15.2 review checklist
    const checklist = await validateReviewChecklist(product, category, skus);
    if (!checklist.passed) {
      throw new BusinessError(
        "ERR_CHECKLIST_FAILED",
        `Product review checklist failed: ${checklist.failures.join("; ")}`,
        { failures: checklist.failures, warnings: checklist.warnings }
      );
    }

    const now = new Date();
    const updated: ProductRow = {
      ...product,
      status: "PENDING_REVIEW",
      submittedBy: actor.id,
      updatedAt: now,
    };

    try {
      await db.update(products).set(updated).where(eq(products.id, productId));
    } catch {
      // Fallback
    }
    memProducts.set(productId, updated);

    // Record status history
    const historyRow: ProductStatusHistoryRow = {
      id: BigInt(memStatusHistory.length + 1),
      productId,
      fromStatus: product.status,
      toStatus: "PENDING_REVIEW",
      actorId: actor.id,
      actorType: "STAFF",
      notes: "Submitted for catalog review",
      createdAt: now,
    };

    try {
      await db
        .insert(productStatusHistory)
        .values(historyRow as InsertProductStatusHistoryRow);
    } catch {
      // Fallback
    }
    memStatusHistory.push(historyRow);

    try {
      await auditService.record(undefined, {
        staffId: actor.id,
        actorType: "STAFF",
        action: "catalog.product_submitted_for_review",
        entityType: "product",
        entityId: productId,
        beforeState: product,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    return { product: updated, warnings: checklist.warnings };
  },

  /**
   * Approves a PENDING_REVIEW product enforcing Four-Eyes principle.
   */
  async approveProduct(
    productId: string,
    actor: Actor,
    notes?: string
  ): Promise<ProductRow> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    assertCanTransitionProductStatus(product.status, "APPROVED");

    // Four-Eyes Rule: Reviewer cannot be creator or submitter
    if (actor.id === product.createdBy || actor.id === product.submittedBy) {
      throw new BusinessError(
        "ERR_FOUR_EYES_VIOLATION",
        "Four-eyes principle violation: Reviewer cannot be the creator or submitter",
        {},
        403
      );
    }

    const now = new Date();
    const updated: ProductRow = {
      ...product,
      status: "APPROVED",
      reviewedBy: actor.id,
      reviewNotes: notes ?? null,
      updatedAt: now,
    };

    try {
      await db.update(products).set(updated).where(eq(products.id, productId));
    } catch {
      // Fallback
    }
    memProducts.set(productId, updated);

    // Record status history
    const historyRow: ProductStatusHistoryRow = {
      id: BigInt(memStatusHistory.length + 1),
      productId,
      fromStatus: product.status,
      toStatus: "APPROVED",
      actorId: actor.id,
      actorType: "STAFF",
      notes: notes ?? "Product approved by reviewer",
      createdAt: now,
    };

    try {
      await db
        .insert(productStatusHistory)
        .values(historyRow as InsertProductStatusHistoryRow);
    } catch {
      // Fallback
    }
    memStatusHistory.push(historyRow);

    try {
      await auditService.record(undefined, {
        staffId: actor.id,
        actorType: "STAFF",
        action: "catalog.product_approved",
        entityType: "product",
        entityId: productId,
        beforeState: product,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    return updated;
  },

  /**
   * Rejects a PENDING_REVIEW product enforcing Four-Eyes principle.
   */
  async rejectProduct(
    productId: string,
    actor: Actor,
    notes?: string
  ): Promise<ProductRow> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    assertCanTransitionProductStatus(product.status, "REJECTED");

    // Four-Eyes Rule
    if (actor.id === product.createdBy || actor.id === product.submittedBy) {
      throw new BusinessError(
        "ERR_FOUR_EYES_VIOLATION",
        "Four-eyes principle violation: Reviewer cannot be the creator or submitter",
        {},
        403
      );
    }

    const now = new Date();
    const updated: ProductRow = {
      ...product,
      status: "REJECTED",
      reviewedBy: actor.id,
      reviewNotes: notes ?? null,
      updatedAt: now,
    };

    try {
      await db.update(products).set(updated).where(eq(products.id, productId));
    } catch {
      // Fallback
    }
    memProducts.set(productId, updated);

    // Record status history
    const historyRow: ProductStatusHistoryRow = {
      id: BigInt(memStatusHistory.length + 1),
      productId,
      fromStatus: product.status,
      toStatus: "REJECTED",
      actorId: actor.id,
      actorType: "STAFF",
      notes: notes ?? "Product rejected by reviewer",
      createdAt: now,
    };

    try {
      await db
        .insert(productStatusHistory)
        .values(historyRow as InsertProductStatusHistoryRow);
    } catch {
      // Fallback
    }
    memStatusHistory.push(historyRow);

    try {
      await auditService.record(undefined, {
        staffId: actor.id,
        actorType: "STAFF",
        action: "catalog.product_rejected",
        entityType: "product",
        entityId: productId,
        beforeState: product,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    return updated;
  },

  /**
   * Publishes an APPROVED product, validating BTRC requirements and emitting outbox event.
   */
  async publishProduct(productId: string, actor: Actor): Promise<ProductRow> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    assertCanTransitionProductStatus(product.status, "PUBLISHED");

    // Must be in APPROVED status before publishing
    if (product.status !== "APPROVED") {
      throw new BusinessError(
        "ERR_ILLEGAL_TRANSITION",
        `Only approved products can be published (current status: '${product.status}')`
      );
    }

    // BTRC Guard
    const category = await this.getCategoryById(product.categoryId);
    if (category?.btrcClearanceRequired) {
      const isApproved = product.btrcStatus === "APPROVED";
      const hasCode = Boolean(product.btrcClearanceCode && product.btrcClearanceCode.trim().length > 0);
      if (!isApproved || !hasCode) {
        throw new BusinessError(
          "ERR_BTRC_CLEARANCE_REQUIRED",
          "Product has wireless RF features. Approved BTRC clearance certificate code required before publishing.",
          {},
          412
        );
      }
    }

    // Zero-replica guard
    if (product.productTier === "BUDGET_SMART" && !product.zeroReplicaAttested) {
      throw new BusinessError(
        "ERR_ZERO_REPLICA_REQUIRED",
        "BUDGET_SMART products require zero_replica_attested before publishing"
      );
    }

    const now = new Date();
    const updated: ProductRow = {
      ...product,
      status: "PUBLISHED",
      publishedAt: now,
      updatedAt: now,
    };

    try {
      await db.update(products).set(updated).where(eq(products.id, productId));
    } catch {
      // Fallback
    }
    memProducts.set(productId, updated);

    // Record status history
    const historyRow: ProductStatusHistoryRow = {
      id: BigInt(memStatusHistory.length + 1),
      productId,
      fromStatus: product.status,
      toStatus: "PUBLISHED",
      actorId: actor.id,
      actorType: "STAFF",
      notes: "Product published to storefront",
      createdAt: now,
    };

    try {
      await db
        .insert(productStatusHistory)
        .values(historyRow as InsertProductStatusHistoryRow);
    } catch {
      // Fallback
    }
    memStatusHistory.push(historyRow);

    // Emit transactional outbox event
    try {
      await emitOutbox(undefined, {
        aggregateType: "product",
        aggregateId: productId,
        type: "catalog.product_published",
        payload: {
          productId: product.id,
          slug: product.slug,
          productTier: product.productTier,
          publishedAt: now.toISOString(),
        },
      });
    } catch {
      // Fallback
    }

    try {
      await auditService.record(undefined, {
        staffId: actor.id,
        actorType: "STAFF",
        action: "catalog.product_published",
        entityType: "product",
        entityId: productId,
        beforeState: product,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    await catalogCache.invalidateProduct(product.slug);

    return updated;
  },

  async archiveProduct(productId: string, actor: Actor, notes?: string): Promise<ProductRow> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    assertCanTransitionProductStatus(product.status, "ARCHIVED");

    const now = new Date();
    const updated: ProductRow = {
      ...product,
      status: "ARCHIVED",
      archivedAt: now,
      updatedAt: now,
    };

    try {
      await db.update(products).set(updated).where(eq(products.id, productId));
    } catch {
      // Fallback
    }
    memProducts.set(productId, updated);

    const historyRow: ProductStatusHistoryRow = {
      id: BigInt(memStatusHistory.length + 1),
      productId,
      fromStatus: product.status,
      toStatus: "ARCHIVED",
      actorId: actor.id,
      actorType: "STAFF",
      notes: notes ?? "Product archived from catalog",
      createdAt: now,
    };

    try {
      await db
        .insert(productStatusHistory)
        .values(historyRow as InsertProductStatusHistoryRow);
    } catch {
      // Fallback
    }
    memStatusHistory.push(historyRow);

    try {
      await auditService.record(undefined, {
        staffId: actor.id,
        actorType: "STAFF",
        action: "catalog.product_archived",
        entityType: "product",
        entityId: productId,
        beforeState: product,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    // Emit transactional outbox event
    try {
      await emitOutbox(undefined, {
        aggregateType: "product",
        aggregateId: productId,
        type: "catalog.product_archived",
        payload: {
          productId: product.id,
          slug: product.slug,
          archivedAt: now.toISOString(),
        },
      });
    } catch {
      // Fallback
    }

    await catalogCache.invalidateProduct(product.slug);

    return updated;
  },

  async unarchiveProduct(productId: string, actor: Actor, notes?: string): Promise<ProductRow> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    assertCanTransitionProductStatus(product.status, "DRAFT");

    const now = new Date();
    const updated: ProductRow = {
      ...product,
      status: "DRAFT",
      archivedAt: null,
      updatedAt: now,
    };

    try {
      await db.update(products).set(updated).where(eq(products.id, productId));
    } catch {
      // Fallback
    }
    memProducts.set(productId, updated);

    const historyRow: ProductStatusHistoryRow = {
      id: BigInt(memStatusHistory.length + 1),
      productId,
      fromStatus: product.status,
      toStatus: "DRAFT",
      actorId: actor.id,
      actorType: "STAFF",
      notes: notes ?? "Product unarchived back to DRAFT",
      createdAt: now,
    };

    try {
      await db
        .insert(productStatusHistory)
        .values(historyRow as InsertProductStatusHistoryRow);
    } catch {
      // Fallback
    }
    memStatusHistory.push(historyRow);

    try {
      await auditService.record(undefined, {
        staffId: actor.id,
        actorType: "STAFF",
        action: "catalog.product_unarchived",
        entityType: "product",
        entityId: productId,
        beforeState: product,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    await catalogCache.invalidateProduct(product.slug);

    return updated;
  },

  /**
   * Generic status transition using TransitionProductStatusDto.
   */
  async transitionProductStatus(
    productId: string,
    input: TransitionProductStatusDto
  ): Promise<ProductRow> {
    const { toStatus, actorId, actorType = "STAFF", notes } = input;
    const actor: Actor = {
      id: actorId ?? "system-actor-id",
      type: actorType === "STAFF" ? "staff" : "system",
      roles: ["SUPER_ADMIN"],
    };

    switch (toStatus) {
      case "PENDING_REVIEW":
        return (await this.submitProductForReview(productId, actor)).product;
      case "APPROVED":
        return this.approveProduct(productId, actor, notes);
      case "REJECTED":
        return this.rejectProduct(productId, actor, notes);
      case "PUBLISHED":
        return this.publishProduct(productId, actor);
      case "ARCHIVED":
        return this.archiveProduct(productId, actor, notes);
      case "DRAFT":
        return this.unarchiveProduct(productId, actor, notes);
      default:
        throw new BusinessError(
          "ERR_ILLEGAL_TRANSITION",
          `Unhandled transition to '${toStatus}'`
        );
    }
  },

  async getProductStatusHistory(productId: string): Promise<ProductStatusHistoryRow[]> {
    try {
      const rows = await db
        .select()
        .from(productStatusHistory)
        .where(eq(productStatusHistory.productId, productId));
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return memStatusHistory.filter((h) => h.productId === productId);
  },

  async listProducts(filter: ProductListFilterDto): Promise<{
    items: ProductRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    let items = Array.from(memProducts.values());

    if (filter.status) {
      items = items.filter((p) => p.status === filter.status);
    }
    if (filter.tier) {
      items = items.filter((p) => p.productTier === filter.tier);
    }
    if (filter.categoryId) {
      items = items.filter((p) => p.categoryId === filter.categoryId);
    }
    if (filter.q) {
      const query = filter.q.toLowerCase();
      items = items.filter(
        (p) =>
          p.titleEn.toLowerCase().includes(query) ||
          p.titleBn.toLowerCase().includes(query) ||
          p.slug.toLowerCase().includes(query)
      );
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return { items: paginatedItems, total, page, limit };
  },

  async getFullProduct(productId: string): Promise<{
    product: ProductRow;
    category: CategoryRow | null;
    brand: BrandRow | null;
    comparisonGroup: ComparisonGroupRow | null;
    skus: SkuRow[];
    media: MediaAssetDto[];
    statusHistory: ProductStatusHistoryRow[];
  }> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const category = await this.getCategoryById(product.categoryId);
    const brand = product.brandId ? await this.getBrandById(product.brandId) : null;
    const comparisonGroup = product.comparisonGroupId
      ? await this.getComparisonGroupById(product.comparisonGroupId)
      : null;
    const productSkus = await this.listSkusByProductId(productId);
    const media = await mediaService.listMediaByOwner("PRODUCT", productId);
    const statusHistory = await this.getProductStatusHistory(productId);

    return {
      product,
      category,
      brand,
      comparisonGroup,
      skus: productSkus,
      media,
      statusHistory,
    };
  },

  // ----------------------------------------------------
  // SKUs
  // ----------------------------------------------------
  /**
   * Validates SKU specs dynamically against category_spec_fields schema.
   */
  async validateSkuSpecs(
    categoryId: string,
    specs?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const fields = await this.getCategorySpecFields(categoryId);
    const schema = buildDynamicSpecSchema(fields);

    const rawSpecs = specs && typeof specs === "object" ? specs : {};
    const parseResult = schema.safeParse(rawSpecs);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      throw new ValidationError(
        `SKU specifications do not match category template: ${issues.map((i) => i.message).join(", ")}`,
        { issues }
      );
    }

    return parseResult.data;
  },

  async createSku(input: CreateSkuDto, actor?: Actor): Promise<SkuRow> {
    const product = await this.getProductById(input.productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.status === "PUBLISHED") {
      throw new BusinessError(
        "ERR_PRODUCT_IMMUTABLE",
        "Adding new SKUs to published products requires moving the product back to DRAFT"
      );
    }

    // Force uppercase SKU code
    const skuCode = input.skuCode.toUpperCase();

    // Check SKU code uniqueness
    const existing = await this.getSkuByCode(skuCode);
    if (existing) {
      throw new BusinessError(
        "ERR_SKU_CODE_ALREADY_EXISTS",
        `SKU code '${skuCode}' already exists`
      );
    }

    // Validate specs against category_spec_fields
    const rawSpecs = input.specs && typeof input.specs === "object" ? input.specs : {};
    const validatedSpecs = await this.validateSkuSpecs(product.categoryId, rawSpecs);

    // Compute max_unit_purchase_paisa: base_cost * (1 + spot_buffer_bp / 10000)
    const spotBufferBp = input.spotBufferBp ?? 600;
    const bufferAmount = Math.round((input.baseCostPaisa * spotBufferBp) / 10000);
    const maxUnitPurchasePaisa = input.baseCostPaisa + bufferAmount;

    const id = crypto.randomUUID();
    const now = new Date();
    const row: SkuRow = {
      id,
      productId: input.productId,
      skuCode,
      barcodeEan13: input.barcodeEan13 ?? null,
      attributes: input.attributes ?? {},
      specs: validatedSpecs,
      pricePaisa: input.pricePaisa,
      compareAtPricePaisa: input.compareAtPricePaisa ?? null,
      baseCostPaisa: input.baseCostPaisa,
      spotBufferBp,
      maxUnitPurchasePaisa,
      warrantyDays: input.warrantyDays ?? 0,
      warrantyType: input.warrantyType,
      officialDistributorName: input.officialDistributorName ?? null,
      weightGrams: input.weightGrams ?? 0,
      dailyOrderCap: input.dailyOrderCap ?? null,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.insert(skus).values(row as InsertSkuRow);
    } catch {
      // Fallback
    }
    memSkus.set(id, row);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.sku_created",
        entityType: "sku",
        entityId: id,
        beforeState: null,
        afterState: row,
      });
    } catch {
      // Fallback
    }

    return row;
  },

  async updateSku(
    productId: string,
    skuId: string,
    input: UpdateSkuDto,
    actor?: Actor
  ): Promise<SkuRow> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const sku = await this.getSkuById(skuId);
    if (!sku || sku.productId !== productId) {
      throw new NotFoundError("SKU not found for product");
    }

    // Published Product SKU update rule:
    // Only pricing & stock fields allowed in-place: pricePaisa, compareAtPricePaisa, baseCostPaisa, spotBufferBp, dailyOrderCap, isActive
    if (product.status === "PUBLISHED") {
      const structuralSkuFields: (keyof UpdateSkuDto)[] = [
        "skuCode",
        "barcodeEan13",
        "attributes",
        "specs",
        "warrantyDays",
        "warrantyType",
        "officialDistributorName",
        "weightGrams",
      ];

      for (const field of structuralSkuFields) {
        if (input[field] !== undefined) {
          throw new BusinessError(
            "ERR_PRODUCT_IMMUTABLE",
            `Structural edits to published SKUs (field '${String(field)}') require moving the product back to DRAFT for re-review`
          );
        }
      }
    }

    const baseCost = input.baseCostPaisa ?? sku.baseCostPaisa;
    const bufferBp = input.spotBufferBp ?? sku.spotBufferBp;
    const bufferAmount = Math.round((baseCost * bufferBp) / 10000);
    const maxUnitPurchasePaisa = baseCost + bufferAmount;

    let specs = sku.specs;
    if (input.specs && product.status !== "PUBLISHED") {
      specs = await this.validateSkuSpecs(product.categoryId, input.specs);
    }

    const now = new Date();
    const updated: SkuRow = {
      ...sku,
      ...input,
      specs,
      maxUnitPurchasePaisa,
      updatedAt: now,
    };

    try {
      await db.update(skus).set(updated).where(eq(skus.id, skuId));
    } catch {
      // Fallback
    }
    memSkus.set(skuId, updated);

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: product.status === "PUBLISHED" ? "catalog.sku_pricing_updated" : "catalog.sku_updated",
        entityType: "sku",
        entityId: skuId,
        beforeState: sku,
        afterState: updated,
      });
    } catch {
      // Fallback
    }

    await catalogCache.invalidateProduct(product.slug);

    if (product.status === "PUBLISHED") {
      try {
        await emitOutbox(undefined, {
          aggregateType: "product",
          aggregateId: product.id,
          type: "catalog.product_updated",
          payload: {
            productId: product.id,
            slug: product.slug,
            productTier: product.productTier,
            updatedAt: now.toISOString(),
          },
        });
      } catch {
        // Fallback
      }
    }

    return updated;
  },

  async getSkuById(id: string): Promise<SkuRow | null> {
    try {
      const rows = await db.select().from(skus).where(eq(skus.id, id)).limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    return memSkus.get(id) ?? null;
  },

  async getSkuByCode(skuCode: string): Promise<SkuRow | null> {
    const upperCode = skuCode.toUpperCase();
    try {
      const rows = await db
        .select()
        .from(skus)
        .where(eq(skus.skuCode, upperCode))
        .limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    for (const s of memSkus.values()) {
      if (s.skuCode === upperCode) return s;
    }
    return null;
  },

  async listSkusByProductId(productId: string): Promise<SkuRow[]> {
    try {
      const rows = await db
        .select()
        .from(skus)
        .where(eq(skus.productId, productId));
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return Array.from(memSkus.values()).filter((s) => s.productId === productId);
  },

  // ----------------------------------------------------
  // Product Media
  // ----------------------------------------------------
  async createImageUploadUrl(
    productId: string,
    input: ProductImageUploadUrlDto,
    actor?: Actor
  ): Promise<{
    media_id: string;
    presigned_upload_url: string;
    storage_key: string;
    expires_in_seconds: number;
  }> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    // Validate size (≤ 10 MB)
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    if (input.sizeBytes > MAX_IMAGE_BYTES) {
      throw new ValidationError("Image file size cannot exceed 10 MB", {
        sizeBytes: input.sizeBytes,
        maxBytes: MAX_IMAGE_BYTES,
      });
    }

    // Validate allowed image types
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(input.contentType)) {
      throw new ValidationError("Only JPG, PNG, and WebP images are supported", {
        contentType: input.contentType,
        allowedTypes,
      });
    }

    const storageKey = `catalog/products/${productId}/${crypto.randomUUID()}-${input.fileName}`;
    const presignedUploadUrl = `https://media.ncamart.com/${storageKey}?mock_signed_put=1`;

    const media = await mediaService.createMediaAsset({
      ownerType: "PRODUCT",
      ownerId: productId,
      kind: input.kind ?? "PRODUCT_IMAGE",
      bucket: "ncamart-catalog-media",
      storageKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      isPublic: true,
      uploadedByType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
      uploadedById: actor?.id ?? "system",
    });

    return {
      media_id: media.id,
      presigned_upload_url: presignedUploadUrl,
      storage_key: storageKey,
      expires_in_seconds: 900,
    };
  },

  async completeImageUpload(
    productId: string,
    mediaId: string,
    actor?: Actor
  ): Promise<MediaAssetDto> {
    const product = await this.getProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const media = await mediaService.getMediaAssetById(mediaId);
    if (!media || media.ownerId !== productId || media.ownerType !== "PRODUCT") {
      throw new NotFoundError("Media asset not found for product");
    }

    const readyMedia = await mediaService.markMediaReady(mediaId);
    if (!readyMedia) {
      throw new NotFoundError("Failed to mark media ready");
    }

    try {
      await auditService.record(undefined, {
        staffId: actor?.id ?? null,
        actorType: actor?.type === "staff" ? "STAFF" : "SYSTEM",
        action: "catalog.media_upload_completed",
        entityType: "media_asset",
        entityId: mediaId,
        beforeState: media,
        afterState: readyMedia,
      });
    } catch {
      // Fallback
    }

    return readyMedia;
  },

  // ----------------------------------------------------
  // Public Catalog APIs (P11)
  // ----------------------------------------------------
  /**
   * Returns category tree with counts of published products (including descendants).
   */
  async getPublicCategoryTree(): Promise<PublicCategoryTreeNode[]> {
    const cached = await catalogCache.get<PublicCategoryTreeNode[]>("catalog:categories:tree");
    if (cached) return cached;

    const allCategories = await this.listCategories();
    const activeCategories = allCategories.filter((c) => c.isActive);

    // Get all published products
    const allProducts = Array.from(memProducts.values());
    const publishedProducts = allProducts.filter((p) => p.status === "PUBLISHED");

    // Helper: compute published count for category including descendants
    const getPublishedCount = (categoryId: string): number => {
      const descendantIds = new Set<string>([categoryId]);
      let added = true;
      while (added) {
        added = false;
        for (const cat of activeCategories) {
          if (cat.parentId && descendantIds.has(cat.parentId) && !descendantIds.has(cat.id)) {
            descendantIds.add(cat.id);
            added = true;
          }
        }
      }
      return publishedProducts.filter((p) => descendantIds.has(p.categoryId)).length;
    };

    // Build hierarchy
    const nodeMap = new Map<string, PublicCategoryTreeNode>();
    for (const cat of activeCategories) {
      nodeMap.set(cat.id, {
        id: cat.id,
        slug: cat.slug,
        name_en: cat.nameEn,
        name_bn: cat.nameBn,
        level: cat.level,
        sort_order: cat.sortOrder,
        published_product_count: getPublishedCount(cat.id),
        children: [],
      });
    }

    const tree: PublicCategoryTreeNode[] = [];
    for (const cat of activeCategories) {
      const node = nodeMap.get(cat.id)!;
      if (cat.parentId && nodeMap.has(cat.parentId)) {
        nodeMap.get(cat.parentId)!.children.push(node);
      } else {
        tree.push(node);
      }
    }

    // Sort nodes at each level by sort_order
    const sortNodes = (nodes: PublicCategoryTreeNode[]) => {
      nodes.sort((a, b) => a.sort_order - b.sort_order);
      for (const n of nodes) {
        if (n.children.length > 0) sortNodes(n.children);
      }
    };
    sortNodes(tree);

    await catalogCache.set("catalog:categories:tree", tree);
    return tree;
  },

  /**
   * Returns all published products from database (or in-memory store in mock/test mode).
   */
  async listPublishedProducts(): Promise<ProductRow[]> {
    try {
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.status, "PUBLISHED"));
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return Array.from(memProducts.values()).filter((p) => p.status === "PUBLISHED");
  },

  /**
   * Returns filtered, paginated list of published products with active SKUs.
   */
  async getPublicProducts(filter: PublicProductFilterDto): Promise<{
    products: PublicProductListItem[];
    pagination: {
      page: number;
      limit: number;
      total_count: number;
      total_pages: number;
    };
  }> {
    const cacheKey = `catalog:list:${hashQueryKey(filter as Record<string, unknown>)}`;
    const cached = await catalogCache.get<{
      products: PublicProductListItem[];
      pagination: { page: number; limit: number; total_count: number; total_pages: number };
    }>(cacheKey);
    if (cached) return cached;

    const allCategories = await this.listCategories();
    const allProducts = Array.from(memProducts.values());

    // 1. Base filter: ONLY PUBLISHED
    let candidateProducts = allProducts.filter((p) => p.status === "PUBLISHED");

    // 2. Category filter (including descendants)
    if (filter.category) {
      const cat = allCategories.find((c) => c.slug === filter.category);
      if (!cat) {
        return {
          products: [],
          pagination: { page: filter.page ?? 1, limit: filter.limit ?? 20, total_count: 0, total_pages: 0 },
        };
      }
      const descendantIds = new Set<string>([cat.id]);
      let added = true;
      while (added) {
        added = false;
        for (const c of allCategories) {
          if (c.parentId && descendantIds.has(c.parentId) && !descendantIds.has(c.id)) {
            descendantIds.add(c.id);
            added = true;
          }
        }
      }
      candidateProducts = candidateProducts.filter((p) => descendantIds.has(p.categoryId));
    }

    // 3. Tier filter
    if (filter.tier) {
      candidateProducts = candidateProducts.filter((p) => p.productTier === filter.tier);
    }

    // 4. Brand filter
    if (filter.brand) {
      const brand = await this.getBrandBySlug(filter.brand);
      if (!brand) {
        return {
          products: [],
          pagination: { page: filter.page ?? 1, limit: filter.limit ?? 20, total_count: 0, total_pages: 0 },
        };
      }
      candidateProducts = candidateProducts.filter((p) => p.brandId === brand.id);
    }

    // 5. Fulfillment filter
    if (filter.fulfillment) {
      const targetFulfillment = filter.fulfillment === "REGULAR_DROP_PACK" ? "DROP_AND_PACK" : filter.fulfillment;
      candidateProducts = candidateProducts.filter((p) => p.fulfillmentType === targetFulfillment);
    }

    // 6. Gather SKUs, availability, and compute pricing
    const brandMap = new Map((await this.listBrands()).map((b) => [b.id, b.name]));
    const items: Array<PublicProductListItem & { sortDate: Date }> = [];

    for (const prod of candidateProducts) {
      const skus = (await this.listSkusByProductId(prod.id)).filter((s) => s.isActive);
      if (skus.length === 0) continue; // Products without active SKUs are omitted

      const minRegularPrice = Math.min(...skus.map((s) => s.compareAtPricePaisa ?? s.pricePaisa));
      const minSalePrice = Math.min(...skus.map((s) => s.pricePaisa));

      // Price range filters
      if (filter.price_min_paisa !== undefined && minSalePrice < filter.price_min_paisa) {
        continue;
      }
      if (filter.price_max_paisa !== undefined && minSalePrice > filter.price_max_paisa) {
        continue;
      }

      // Check SKU availability
      const skuAvailabilityMap = await availabilityService.getSkuAvailability(skus.map((s) => s.id));
      const skuStatuses = skus.map((s) => skuAvailabilityMap[s.id]?.status ?? "OUT_OF_STOCK");

      let overallStatus: AvailabilityStatus = "OUT_OF_STOCK";
      if (prod.fulfillmentType === "PRE_ORDER") {
        overallStatus = "PRE_ORDER";
      } else if (skuStatuses.includes("IN_STOCK")) {
        overallStatus = "IN_STOCK";
      } else if (skuStatuses.includes("AVAILABLE")) {
        overallStatus = "AVAILABLE";
      }

      // Filter by availability requirement
      if (filter.availability === "IN_STOCK" && overallStatus !== "IN_STOCK") {
        continue;
      }
      if (filter.availability === "AVAILABLE" && overallStatus !== "IN_STOCK" && overallStatus !== "AVAILABLE") {
        continue;
      }

      // Primary image URL
      const mediaList = await mediaService.listMediaByOwner("PRODUCT", prod.id);
      const readyImage = mediaList.find((m) => m.kind === "PRODUCT_IMAGE" && m.status === "READY");
      const primaryImageUrl = readyImage ? `https://cdn.ncamart.com/${readyImage.storageKey}` : null;

      const brandName = prod.brandId ? brandMap.get(prod.brandId) ?? null : null;

      items.push({
        id: prod.id,
        title_en: prod.titleEn,
        title_bn: prod.titleBn,
        slug: prod.slug,
        product_tier: prod.productTier,
        brand_name: brandName,
        min_regular_price_paisa: minRegularPrice,
        min_sale_price_paisa: minSalePrice,
        primary_image_url: primaryImageUrl,
        comparison_group_id: prod.comparisonGroupId ?? null,
        tier_badge: {
          code: prod.productTier,
          label_en: prod.productTier === "AUTHENTIC" ? "Authentic" : "Budget Smart",
          label_bn: prod.productTier === "AUTHENTIC" ? "অথেনটিক" : "বাজেট স্মার্ট",
        },
        availability_label: formatAvailabilityLabel(overallStatus),
        sortDate: prod.publishedAt ?? prod.createdAt,
      });
    }

    // 7. Sort
    if (filter.sort === "PRICE_ASC") {
      items.sort((a, b) => a.min_sale_price_paisa - b.min_sale_price_paisa);
    } else if (filter.sort === "PRICE_DESC") {
      items.sort((a, b) => b.min_sale_price_paisa - a.min_sale_price_paisa);
    } else {
      // NEWEST
      items.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
    }

    // 8. Pagination
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.max(1, Math.min(100, filter.limit ?? 20));
    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit).map(({ sortDate: _, ...item }) => item);

    const response = {
      products: paginatedItems,
      pagination: {
        page,
        limit,
        total_count: totalCount,
        total_pages: totalPages,
      },
    };

    await catalogCache.set(cacheKey, response);
    return response;
  },

  /**
   * Returns rich detail for a published product by slug, including rendered specs, media CDN URLs, and JSON-LD.
   */
  async getPublicProductDetail(slug: string): Promise<PublicProductDetail> {
    const cached = await catalogCache.get<PublicProductDetail>(`catalog:product:${slug}`);
    if (cached) return cached;

    const product = await this.getProductBySlug(slug);
    if (!product || product.status !== "PUBLISHED") {
      throw new NotFoundError("Product not found");
    }

    const category = await this.getCategoryById(product.categoryId);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    const brand = product.brandId ? await this.getBrandById(product.brandId) : null;
    const specFields = await this.getCategorySpecFields(product.categoryId);
    const rawSkus = await this.listSkusByProductId(product.id);
    const activeSkus = rawSkus.filter((s) => s.isActive);

    const skuAvailabilityMap = await availabilityService.getSkuAvailability(activeSkus.map((s) => s.id));

    // Render SKUs with template labels and units
    const renderedSkus: PublicSkuDetail[] = activeSkus.map((sku) => {
      const rawSpecs = (sku.specs && typeof sku.specs === "object" ? sku.specs : {}) as Record<string, unknown>;
      const renderedSpecs: PublicSkuSpecItem[] = [];

      for (const field of specFields) {
        if (rawSpecs[field.keyName] !== undefined && rawSpecs[field.keyName] !== null) {
          renderedSpecs.push({
            key: field.keyName,
            label_en: field.labelEn,
            label_bn: field.labelBn,
            value: rawSpecs[field.keyName],
            unit: field.unit ?? null,
            is_highlighted: field.isHighlightedForComparison ?? false,
          });
        }
      }

      const availStatus: AvailabilityStatus =
        product.fulfillmentType === "PRE_ORDER"
          ? "PRE_ORDER"
          : skuAvailabilityMap[sku.id]?.status ?? "OUT_OF_STOCK";
      const physicalQty = skuAvailabilityMap[sku.id]?.physicalQty ?? 0;
      const formattedAvail = formatAvailabilityLabel(availStatus);

      return {
        id: sku.id,
        sku_code: sku.skuCode,
        barcode_ean13: sku.barcodeEan13 ?? null,
        price_paisa: sku.pricePaisa,
        compare_at_price_paisa: sku.compareAtPricePaisa ?? null,
        attributes: (sku.attributes as Record<string, string>) ?? {},
        specs: renderedSpecs,
        warranty_label: {
          code: sku.warrantyType,
          days: sku.warrantyDays,
          ...formatWarrantyLabel(sku.warrantyType, sku.warrantyDays),
        },
        availability: {
          status: availStatus,
          physical_qty: physicalQty,
          label_en: formattedAvail.label_en,
          label_bn: formattedAvail.label_bn,
        },
      };
    });

    // Media
    const mediaList = await mediaService.listMediaByOwner("PRODUCT", product.id);
    const publicMedia = mediaList
      .filter((m) => m.status === "READY")
      .map((m) => ({
        id: m.id,
        url: `https://cdn.ncamart.com/${m.storageKey}`,
        kind: m.kind,
        content_type: m.contentType,
      }));

    // Preorder info
    const preorderInfo =
      product.fulfillmentType === "PRE_ORDER"
        ? {
            eta_days_min: product.preorderEtaDaysMin ?? null,
            eta_days_max: product.preorderEtaDaysMax ?? null,
            deposit_preview_paisa: null, // TODO(P15)
          }
        : null;

    // Schema.org JSON-LD
    const primaryImage = publicMedia.find((m) => m.kind === "PRODUCT_IMAGE") ?? publicMedia[0];
    const minPrice = renderedSkus.length > 0 ? Math.min(...renderedSkus.map((s) => s.price_paisa)) : 0;
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.titleEn,
      description: product.descriptionEn ?? product.titleEn,
      image: primaryImage ? primaryImage.url : undefined,
      brand: brand ? { "@type": "Brand", name: brand.name } : undefined,
      gtin: renderedSkus.find((s) => s.barcode_ean13)?.barcode_ean13 ?? undefined,
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "BDT",
        lowPrice: (minPrice / 100).toFixed(2),
        offerCount: renderedSkus.length,
        availability: renderedSkus.some((s) => s.availability.status === "IN_STOCK")
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    };

    const detail: PublicProductDetail = {
      id: product.id,
      title_en: product.titleEn,
      title_bn: product.titleBn,
      slug: product.slug,
      product_tier: product.productTier,
      tier_badge: {
        code: product.productTier,
        label_en: product.productTier === "AUTHENTIC" ? "Authentic" : "Budget Smart",
        label_bn: product.productTier === "AUTHENTIC" ? "অথেনটিক" : "বাজেট স্মার্ট",
      },
      description_en: product.descriptionEn ?? null,
      description_bn: product.descriptionBn ?? null,
      fulfillment_type: product.fulfillmentType,
      origin_country: product.originCountry ?? null,
      vat_rate_bp: product.vatRateBp,
      zero_replica_attested: product.zeroReplicaAttested,
      comparison_group_id: product.comparisonGroupId ?? null,
      brand: brand
        ? {
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
          }
        : null,
      category: {
        id: category.id,
        name_en: category.nameEn,
        name_bn: category.nameBn,
        slug: category.slug,
      },
      skus: renderedSkus,
      media: publicMedia,
      preorder_info: preorderInfo,
      comparison_points_en: product.comparisonPointsEn ?? null,
      comparison_points_bn: product.comparisonPointsBn ?? null,
      seo: {
        title: product.seoTitle ?? product.titleEn,
        description: product.seoDescription ?? product.descriptionEn ?? null,
      },
      json_ld: jsonLd,
    };

    await catalogCache.set(`catalog:product:${slug}`, detail);
    return detail;
  },

  /**
   * Returns side-by-side spec comparison between Authentic and Budget Smart counterparts.
   */
  async getPublicComparisonView(comparisonGroupId: string): Promise<PublicComparisonView> {
    const cached = await catalogCache.get<PublicComparisonView>(`catalog:compare:${comparisonGroupId}`);
    if (cached) return cached;

    const group = await this.getComparisonGroupById(comparisonGroupId);
    if (!group) {
      throw new NotFoundError("Comparison group not found");
    }

    const allProducts = Array.from(memProducts.values());
    const groupProducts = allProducts.filter(
      (p) => p.comparisonGroupId === comparisonGroupId && p.status === "PUBLISHED"
    );

    const authProduct = groupProducts.find((p) => p.productTier === "AUTHENTIC");
    const budgetProduct = groupProducts.find((p) => p.productTier === "BUDGET_SMART");

    // Get primary active SKUs
    const authSku = authProduct
      ? (await this.listSkusByProductId(authProduct.id)).find((s) => s.isActive)
      : undefined;
    const budgetSku = budgetProduct
      ? (await this.listSkusByProductId(budgetProduct.id)).find((s) => s.isActive)
      : undefined;

    // Highlighted fields for spec diff (ordered by sort_order ASC)
    const categoryId = group.categoryId ?? authProduct?.categoryId ?? budgetProduct?.categoryId;
    const specFields = categoryId
      ? (await this.getCategorySpecFields(categoryId))
          .filter((f) => f.isHighlightedForComparison)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [];

    const authSpecs = (authSku?.specs && typeof authSku.specs === "object" ? authSku.specs : {}) as Record<string, unknown>;
    const budgetSpecs = (budgetSku?.specs && typeof budgetSku.specs === "object" ? budgetSku.specs : {}) as Record<string, unknown>;

    const specDiff: PublicComparisonDiffItem[] = specFields.map((field) => ({
      key: field.keyName,
      label_en: field.labelEn,
      label_bn: field.labelBn,
      unit: field.unit ?? null,
      authentic_value: authSpecs[field.keyName] ?? null,
      budget_smart_value: budgetSpecs[field.keyName] ?? null,
    }));

    const authenticItem: PublicComparisonItem | null =
      authProduct && authSku
        ? {
            id: authProduct.id,
            title_en: authProduct.titleEn,
            title_bn: authProduct.titleBn,
            slug: authProduct.slug,
            price_paisa: authSku.pricePaisa,
            warranty_label: formatWarrantyLabel(authSku.warrantyType, authSku.warrantyDays).label_en,
            badge_label: group.badgeAuthenticLabel,
            specs: authSpecs,
          }
        : null;

    const budgetSmartItem: PublicComparisonItem | null =
      budgetProduct && budgetSku
        ? {
            id: budgetProduct.id,
            title_en: budgetProduct.titleEn,
            title_bn: budgetProduct.titleBn,
            slug: budgetProduct.slug,
            price_paisa: budgetSku.pricePaisa,
            warranty_label: formatWarrantyLabel(budgetSku.warrantyType, budgetSku.warrantyDays).label_en,
            badge_label: group.badgeBudgetLabel,
            specs: budgetSpecs,
          }
        : null;

    const result: PublicComparisonView = {
      comparison_group_id: group.id,
      name: group.name,
      authentic_item: authenticItem,
      budget_smart_item: budgetSmartItem,
      spec_diff: specDiff,
      comparison_verdict: {
        summary_en: group.verdictEn ?? null,
        summary_bn: group.verdictBn ?? null,
      },
    };

    await catalogCache.set(`catalog:compare:${comparisonGroupId}`, result);
    return result;
  },
};
