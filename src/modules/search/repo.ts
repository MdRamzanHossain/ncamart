import { catalogService, CategoryRow, ProductRow } from "@/modules/catalog";
import { availabilityService } from "@/modules/catalog/availability";
import { ProductSearchDocument } from "./dto";

// In-memory document store used for offline / mock / test fallback
const memSearchDocuments = new Map<string, ProductSearchDocument>();

/**
 * Builds a search document for a published product.
 * Returns null if the product is not published or has no active SKUs.
 */
export async function buildProductSearchDocument(
  productId: string
): Promise<ProductSearchDocument | null> {
  const product: ProductRow | null = await catalogService.getProductById(productId);
  if (!product || product.status !== "PUBLISHED") {
    return null;
  }

  // 1. Resolve category ancestry chain
  const allCategories: CategoryRow[] = await catalogService.listCategories();
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  const ancestry: CategoryRow[] = [];
  let currentCat = categoryMap.get(product.categoryId);
  while (currentCat) {
    ancestry.unshift(currentCat);
    if (!currentCat.parentId) break;
    currentCat = categoryMap.get(currentCat.parentId);
  }

  const category_ids = ancestry.map((c) => c.id);
  const category_path_en = ancestry.map((c) => c.nameEn).join(" > ");
  const category_path_bn = ancestry.map((c) => c.nameBn).join(" > ");

  // 2. Resolve brand name
  let brandName = "";
  if (product.brandId) {
    const brand = await catalogService.getBrandById(product.brandId);
    if (brand) {
      brandName = brand.name;
    }
  }

  // 3. Resolve active SKUs
  const allSkus = await catalogService.listSkusByProductId(product.id);
  const activeSkus = allSkus.filter((s) => s.isActive);
  if (activeSkus.length === 0) {
    return null;
  }

  // 4. Calculate min price
  const min_price_paisa = Math.min(...activeSkus.map((s) => s.pricePaisa));

  // 5. Calculate availability
  const skuAvailabilityMap = await availabilityService.getSkuAvailability(
    activeSkus.map((s) => s.id)
  );
  const skuStatuses = activeSkus.map(
    (s) => skuAvailabilityMap[s.id]?.status ?? "OUT_OF_STOCK"
  );

  let availability = "OUT_OF_STOCK";
  if (product.fulfillmentType === "PRE_ORDER") {
    availability = "PRE_ORDER";
  } else if (skuStatuses.includes("IN_STOCK")) {
    availability = "IN_STOCK";
  } else if (skuStatuses.includes("AVAILABLE")) {
    availability = "AVAILABLE";
  }

  // 6. Extract spec keywords
  const specKeywordsSet = new Set<string>();

  for (const sku of activeSkus) {
    if (sku.specs && typeof sku.specs === "object") {
      for (const [key, val] of Object.entries(sku.specs as Record<string, unknown>)) {
        if (typeof val === "string" && val.trim().length > 0) {
          specKeywordsSet.add(val.trim());
        } else if (typeof val === "number" || typeof val === "boolean") {
          specKeywordsSet.add(String(val));
          specKeywordsSet.add(`${val} ${key}`);
        }
      }
    }
    if (sku.attributes && typeof sku.attributes === "object") {
      for (const val of Object.values(sku.attributes as Record<string, string>)) {
        if (typeof val === "string" && val.trim().length > 0) {
          specKeywordsSet.add(val.trim());
        }
      }
    }
  }

  if (product.comparisonPointsEn) {
    for (const pt of product.comparisonPointsEn) {
      specKeywordsSet.add(pt);
    }
  }
  if (product.comparisonPointsBn) {
    for (const pt of product.comparisonPointsBn) {
      specKeywordsSet.add(pt);
    }
  }
  if (brandName) {
    specKeywordsSet.add(brandName);
  }

  const sku_codes = activeSkus.map((s) => s.skuCode);
  const published_at = product.publishedAt
    ? new Date(product.publishedAt).getTime()
    : new Date(product.createdAt).getTime();

  return {
    id: product.id,
    slug: product.slug,
    title_en: product.titleEn,
    title_bn: product.titleBn,
    brand: brandName,
    category_ids,
    category_path_en,
    category_path_bn,
    tier: product.productTier,
    fulfillment_type: product.fulfillmentType,
    min_price_paisa,
    availability,
    spec_keywords: Array.from(specKeywordsSet),
    sku_codes,
    published_at,
  };
}

export const searchRepo = {
  saveDocument(doc: ProductSearchDocument): void {
    memSearchDocuments.set(doc.id, doc);
  },

  deleteDocument(id: string): void {
    memSearchDocuments.delete(id);
  },

  getDocument(id: string): ProductSearchDocument | null {
    return memSearchDocuments.get(id) ?? null;
  },

  getAllDocuments(): ProductSearchDocument[] {
    return Array.from(memSearchDocuments.values());
  },

  clearDocuments(): void {
    memSearchDocuments.clear();
  },
};
