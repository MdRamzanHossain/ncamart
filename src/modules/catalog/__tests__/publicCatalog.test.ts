import { describe, it, expect, beforeEach } from "vitest";
import {
  catalogService,
  availabilityService,
  catalogCache,
} from "../index";
import { mediaService } from "@/modules/media";
import { clearMemoryOutboxForTesting } from "@/lib/outbox";
import { clearMemoryAuditChainForTesting } from "@/modules/audit";
import { NotFoundError } from "@/lib/errors";
import { Actor } from "@/lib/http/route";

describe("Public Catalog APIs — P11", () => {
  const staffActor: Actor = {
    id: "admin-actor-uuid",
    type: "staff",
    roles: ["SUPER_ADMIN"],
  };

  beforeEach(() => {
    catalogService.clearMemoryCatalogForTesting();
    mediaService.clearMemoryMediaForTesting();
    clearMemoryOutboxForTesting();
    clearMemoryAuditChainForTesting();
  });

  describe("1. Unpublished Products are Invisible & Active SKU Guard", () => {
    it("excludes non-published products (DRAFT, PENDING_REVIEW, APPROVED, ARCHIVED) from public listings", async () => {
      const cat = await catalogService.createCategory({
        slug: "chargers",
        nameEn: "Chargers",
        nameBn: "চার্জার",
        level: 1,
      });

      // 1. DRAFT Product
      const draftProd = await catalogService.createProduct(
        {
          slug: "draft-charger",
          titleEn: "Draft Charger",
          titleBn: "ড্রাফট চার্জার",
          categoryId: cat.id,
          productTier: "BUDGET_SMART",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: draftProd.id,
          skuCode: "DRAFT-SKU-01",
          pricePaisa: 120000,
          baseCostPaisa: 80000,
          weightGrams: 50,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 7,
        },
        staffActor
      );

      // 2. PUBLISHED Product
      const publishedProd = await catalogService.createProduct(
        {
          slug: "published-charger",
          titleEn: "Published Charger",
          titleBn: "পাবলিশড চার্জার",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: publishedProd.id,
          skuCode: "PUB-SKU-01",
          pricePaisa: 250000,
          baseCostPaisa: 180000,
          weightGrams: 85,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          warrantyDays: 730,
        },
        staffActor
      );

      catalogService.setProductStatusForTesting(publishedProd.id, "APPROVED");
      await catalogService.publishProduct(publishedProd.id, staffActor);

      // Query public products
      const list = await catalogService.getPublicProducts({});
      expect(list.products).toHaveLength(1);
      expect(list.products[0]?.slug).toBe("published-charger");
      expect(list.products[0]?.tier_badge.code).toBe("AUTHENTIC");
      expect(list.products[0]?.tier_badge.label_en).toBe("Authentic");

      // Direct slug detail query
      await expect(catalogService.getPublicProductDetail("draft-charger")).rejects.toThrow(NotFoundError);
      const detail = await catalogService.getPublicProductDetail("published-charger");
      expect(detail.id).toBe(publishedProd.id);
      expect(detail.skus).toHaveLength(1);
      expect(detail.skus[0]?.sku_code).toBe("PUB-SKU-01");
    });

    it("omits products with zero active SKUs from public listing", async () => {
      const cat = await catalogService.createCategory({
        slug: "cables",
        nameEn: "Cables",
        nameBn: "কেবল",
        level: 1,
      });

      const prod = await catalogService.createProduct(
        {
          slug: "no-active-sku-cable",
          titleEn: "Inactive Cable",
          titleBn: "নিষ্ক্রিয় কেবল",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );

      const sku = await catalogService.createSku(
        {
          productId: prod.id,
          skuCode: "INACTIVE-SKU-01",
          pricePaisa: 50000,
          baseCostPaisa: 30000,
          weightGrams: 30,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 7,
        },
        staffActor
      );

      // Deactivate SKU
      await catalogService.updateSku(prod.id, sku.id, { isActive: false }, staffActor);

      catalogService.setProductStatusForTesting(prod.id, "APPROVED");
      await catalogService.publishProduct(prod.id, staffActor);

      const list = await catalogService.getPublicProducts({});
      expect(list.products).toHaveLength(0);
    });
  });

  describe("2. Category Tree & Descendants Filtering", () => {
    it("aggregates product counts across child/descendant subcategories", async () => {
      // Root: Electronics -> Audio -> Earbuds
      const rootCat = await catalogService.createCategory({
        slug: "electronics",
        nameEn: "Electronics",
        nameBn: "ইলেকট্রনিক্স",
        level: 1,
      });
      const audioCat = await catalogService.createCategory({
        parentId: rootCat.id,
        slug: "audio",
        nameEn: "Audio",
        nameBn: "অডিও",
        level: 2,
      });
      const earbudsCat = await catalogService.createCategory({
        parentId: audioCat.id,
        slug: "earbuds",
        nameEn: "Earbuds",
        nameBn: "ইয়ারবাডস",
        level: 3,
      });

      // Product 1 in Audio
      const p1 = await catalogService.createProduct(
        {
          slug: "speaker-bt",
          titleEn: "Bluetooth Speaker",
          titleBn: "ব্লুটুথ স্পিকার",
          categoryId: audioCat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: p1.id,
          skuCode: "SPK-01",
          pricePaisa: 300000,
          baseCostPaisa: 200000,
          weightGrams: 250,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          warrantyDays: 365,
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(p1.id, "APPROVED");
      await catalogService.publishProduct(p1.id, staffActor);

      // Product 2 in Earbuds
      const p2 = await catalogService.createProduct(
        {
          slug: "anc-earbuds",
          titleEn: "ANC Wireless Earbuds",
          titleBn: "এএনসি ওয়্যারলেস ইয়ারবাডস",
          categoryId: earbudsCat.id,
          productTier: "BUDGET_SMART",
          fulfillmentType: "DROP_AND_PACK",
          zeroReplicaAttested: true,
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: p2.id,
          skuCode: "EAR-01",
          pricePaisa: 150000,
          baseCostPaisa: 90000,
          weightGrams: 45,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 30,
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(p2.id, "APPROVED");
      await catalogService.publishProduct(p2.id, staffActor);

      // Check category tree
      const tree = await catalogService.getPublicCategoryTree();
      expect(tree).toHaveLength(1);
      const rootNode = tree[0]!;
      expect(rootNode.slug).toBe("electronics");
      // Root contains products from Audio (1) + Earbuds (1) = 2
      expect(rootNode.published_product_count).toBe(2);

      const audioNode = rootNode.children[0]!;
      expect(audioNode.slug).toBe("audio");
      expect(audioNode.published_product_count).toBe(2);

      const earbudsNode = audioNode.children[0]!;
      expect(earbudsNode.slug).toBe("earbuds");
      expect(earbudsNode.published_product_count).toBe(1);

      // Filter products by root category slug includes all descendants
      const rootList = await catalogService.getPublicProducts({ category: "electronics" });
      expect(rootList.products).toHaveLength(2);

      // Filter products by leaf category slug returns only leaf
      const leafList = await catalogService.getPublicProducts({ category: "earbuds" });
      expect(leafList.products).toHaveLength(1);
      expect(leafList.products[0]?.slug).toBe("anc-earbuds");
    });
  });

  describe("3. Comparison Diff Matrix & Template Ordering", () => {
    it("renders spec diffs respecting template sort_order with value badges and verdict", async () => {
      const cat = await catalogService.createCategory({
        slug: "chargers-comp",
        nameEn: "Chargers Comp",
        nameBn: "চার্জার কম্পেয়ার",
        level: 1,
      });

      // Spec template fields in specific sortOrder
      await catalogService.createCategorySpecField(
        {
          categoryId: cat.id,
          keyName: "operating_temp",
          labelEn: "Operating Temp",
          labelBn: "অপারেটিং তাপমাত্রা",
          unit: "°C",
          fieldType: "STRING",
          isHighlightedForComparison: true,
          sortOrder: 20,
        },
        staffActor
      );
      await catalogService.createCategorySpecField(
        {
          categoryId: cat.id,
          keyName: "max_power",
          labelEn: "Max Power",
          labelBn: "সর্বোচ্চ পাওয়ার",
          unit: "W",
          fieldType: "NUMBER",
          isHighlightedForComparison: true,
          sortOrder: 10, // Higher priority than operating_temp
        },
        staffActor
      );
      await catalogService.createCategorySpecField(
        {
          categoryId: cat.id,
          keyName: "unhighlighted_spec",
          labelEn: "Internal Note",
          labelBn: "নোট",
          fieldType: "STRING",
          isHighlightedForComparison: false, // Should NOT appear in compare diff
          sortOrder: 5,
        },
        staffActor
      );

      const group = await catalogService.createComparisonGroup(
        {
          name: "65W GaN Battle",
          categoryId: cat.id,
          badgeAuthenticLabel: "Full Safety Suite (GaN III)",
          badgeBudgetLabel: "Verified Safe Lab Tested",
          verdictEn: "Choose Authentic for cooler operation; choose Budget Smart to save 50%.",
          verdictBn: "কুলার অপারেশনের জন্য অথেনটিক; ৫০% সাশ্রয়ের জন্য বাজেট স্মার্ট নিন।",
        },
        staffActor
      );

      // 1. Authentic Product
      const authProduct = await catalogService.createProduct(
        {
          slug: "ugreen-nexode-65w",
          titleEn: "UGREEN Nexode 65W GaN",
          titleBn: "ইউগ্রীন নেক্সোড ৬৫ ওয়াট",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
          comparisonGroupId: group.id,
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: authProduct.id,
          skuCode: "UGR-65W",
          pricePaisa: 280000,
          baseCostPaisa: 200000,
          weightGrams: 90,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          warrantyDays: 730,
          specs: {
            max_power: 65,
            operating_temp: "<45",
            unhighlighted_spec: "Internal authentic note",
          },
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(authProduct.id, "APPROVED");
      await catalogService.publishProduct(authProduct.id, staffActor);

      // 2. Budget Smart Product
      const budgetProduct = await catalogService.createProduct(
        {
          slug: "nca-pro-65w",
          titleEn: "NCA Pro 65W GaN",
          titleBn: "এনসিএ প্রো ৬৫ ওয়াট",
          categoryId: cat.id,
          productTier: "BUDGET_SMART",
          fulfillmentType: "DROP_AND_PACK",
          zeroReplicaAttested: true,
          comparisonGroupId: group.id,
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: budgetProduct.id,
          skuCode: "NCA-65W",
          pricePaisa: 140000,
          baseCostPaisa: 90000,
          weightGrams: 85,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 14,
          specs: {
            max_power: 65,
            operating_temp: "58",
            unhighlighted_spec: "Internal budget note",
          },
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(budgetProduct.id, "APPROVED");
      await catalogService.publishProduct(budgetProduct.id, staffActor);

      // Get Comparison View
      const comparison = await catalogService.getPublicComparisonView(group.id);

      expect(comparison.comparison_group_id).toBe(group.id);
      expect(comparison.authentic_item).toBeDefined();
      expect(comparison.authentic_item?.title_en).toBe("UGREEN Nexode 65W GaN");
      expect(comparison.authentic_item?.price_paisa).toBe(280000);
      expect(comparison.authentic_item?.badge_label).toBe("Full Safety Suite (GaN III)");
      expect(comparison.authentic_item?.warranty_label).toContain("2-Year Official Replacement");

      expect(comparison.budget_smart_item).toBeDefined();
      expect(comparison.budget_smart_item?.title_en).toBe("NCA Pro 65W GaN");
      expect(comparison.budget_smart_item?.price_paisa).toBe(140000);
      expect(comparison.budget_smart_item?.badge_label).toBe("Verified Safe Lab Tested");
      expect(comparison.budget_smart_item?.warranty_label).toContain("14-Day NCAMart Shop Replacement");

      // Verify template sortOrder priority: max_power (10) BEFORE operating_temp (20)
      expect(comparison.spec_diff).toHaveLength(2);
      expect(comparison.spec_diff[0]?.key).toBe("max_power");
      expect(comparison.spec_diff[0]?.authentic_value).toBe(65);
      expect(comparison.spec_diff[0]?.budget_smart_value).toBe(65);
      expect(comparison.spec_diff[0]?.unit).toBe("W");

      expect(comparison.spec_diff[1]?.key).toBe("operating_temp");
      expect(comparison.spec_diff[1]?.authentic_value).toBe("<45");
      expect(comparison.spec_diff[1]?.budget_smart_value).toBe("58");

      expect(comparison.comparison_verdict.summary_en).toContain("Choose Authentic");
    });
  });

  describe("4. Cache Invalidation & TTL (Redis / Memory)", () => {
    it("caches product detail and automatically invalidates cache upon product/sku update", async () => {
      const cat = await catalogService.createCategory({
        slug: "adapters",
        nameEn: "Adapters",
        nameBn: "অ্যাডাপ্টার",
        level: 1,
      });

      const prod = await catalogService.createProduct(
        {
          slug: "anker-nano-30w",
          titleEn: "Anker Nano 30W",
          titleBn: "অ্যাঙ্কার ন্যানো ৩০ ওয়াট",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );

      const sku = await catalogService.createSku(
        {
          productId: prod.id,
          skuCode: "ANK-30W-BLK",
          pricePaisa: 180000,
          baseCostPaisa: 120000,
          weightGrams: 40,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          warrantyDays: 365,
        },
        staffActor
      );

      catalogService.setProductStatusForTesting(prod.id, "APPROVED");
      await catalogService.publishProduct(prod.id, staffActor);

      // 1. Initial read populates cache
      const initialDetail = await catalogService.getPublicProductDetail("anker-nano-30w");
      expect(initialDetail.title_en).toBe("Anker Nano 30W");
      expect(initialDetail.skus[0]?.price_paisa).toBe(180000);

      const cached = await catalogCache.get<typeof initialDetail>("catalog:product:anker-nano-30w");
      expect(cached).toBeDefined();
      expect(cached?.title_en).toBe("Anker Nano 30W");

      // 2. SKU price revision busts the cache
      await catalogService.updateSku(
        prod.id,
        sku.id,
        {
          pricePaisa: 175000,
        },
        staffActor
      );

      // Verify cache key was cleared
      const cacheAfterUpdate = await catalogCache.get("catalog:product:anker-nano-30w");
      expect(cacheAfterUpdate).toBeNull();

      // Next read returns fresh data
      const refreshedDetail = await catalogService.getPublicProductDetail("anker-nano-30w");
      expect(refreshedDetail.skus[0]?.price_paisa).toBe(175000);
    });
  });

  describe("5. Availability Labels & Pre-Order Behavior", () => {
    it("renders availability status, physical quantity, and preorder flags correctly", async () => {
      const cat = await catalogService.createCategory({
        slug: "flagship-chargers",
        nameEn: "Flagship",
        nameBn: "ফ্ল্যাগশিপ",
        level: 1,
      });

      // Regular drop & pack product with mock availability
      const prod = await catalogService.createProduct(
        {
          slug: "custom-avail-charger",
          titleEn: "Custom Avail Charger",
          titleBn: "কাস্টম চার্জার",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );

      const sku = await catalogService.createSku(
        {
          productId: prod.id,
          skuCode: "CUST-SKU-01",
          pricePaisa: 200000,
          baseCostPaisa: 140000,
          weightGrams: 55,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          warrantyDays: 365,
        },
        staffActor
      );

      availabilityService.setMockSkuAvailability(sku.id, {
        status: "AVAILABLE",
        physicalQty: 2,
      });

      catalogService.setProductStatusForTesting(prod.id, "APPROVED");
      await catalogService.publishProduct(prod.id, staffActor);

      const detail = await catalogService.getPublicProductDetail("custom-avail-charger");
      expect(detail.skus[0]?.availability.status).toBe("AVAILABLE");
      expect(detail.skus[0]?.availability.label_en).toBe("Available — ships within 24h");
      expect(detail.skus[0]?.availability.label_bn).toBe("সংগ্রহযোগ্য — ২৪ ঘণ্টার মধ্যে ডেলিভারি");

      // Preorder Product
      const preorderProd = await catalogService.createProduct(
        {
          slug: "preorder-power-bank",
          titleEn: "NextGen 140W Power Bank",
          titleBn: "নেক্সটজেন ১৪০ ওয়াট পাওয়ার ব্যাংক",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "PRE_ORDER",
          preorderEtaDaysMin: 7,
          preorderEtaDaysMax: 14,
        },
        staffActor
      );

      await catalogService.createSku(
        {
          productId: preorderProd.id,
          skuCode: "PRE-PB-140W",
          pricePaisa: 850000,
          baseCostPaisa: 600000,
          weightGrams: 450,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          warrantyDays: 365,
        },
        staffActor
      );

      catalogService.setProductStatusForTesting(preorderProd.id, "APPROVED");
      await catalogService.publishProduct(preorderProd.id, staffActor);

      const preorderDetail = await catalogService.getPublicProductDetail("preorder-power-bank");
      expect(preorderDetail.fulfillment_type).toBe("PRE_ORDER");
      expect(preorderDetail.preorder_info).toEqual({
        eta_days_min: 7,
        eta_days_max: 14,
        deposit_preview_paisa: null,
      });
      expect(preorderDetail.skus[0]?.availability.status).toBe("PRE_ORDER");
      expect(preorderDetail.skus[0]?.availability.label_en).toBe("Pre-order");
      expect(preorderDetail.skus[0]?.availability.label_bn).toBe("প্রি-অর্ডার");

      // Schema.org JSON-LD
      expect(preorderDetail.json_ld["@type"]).toBe("Product");
      expect(preorderDetail.json_ld.name).toBe("NextGen 140W Power Bank");
    });
  });
});
