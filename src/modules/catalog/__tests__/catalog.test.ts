import { describe, it, expect, beforeEach } from "vitest";
import { catalogService } from "../index";
import { mediaService } from "@/modules/media";
import { BusinessError, ValidationError } from "@/lib/errors";

describe("Catalog Module — Categories, Spec Templates, Products & SKUs (P09)", () => {
  beforeEach(() => {
    catalogService.clearMemoryCatalogForTesting();
    mediaService.clearMemoryMediaForTesting();
  });

  describe("1. Slug & SKU Uniqueness", () => {
    it("enforces uniqueness on category slugs", async () => {
      await catalogService.createCategory({
        slug: "chargers",
        nameEn: "Chargers",
        nameBn: "চার্জার",
        level: 1,
      });

      await expect(
        catalogService.createCategory({
          slug: "chargers",
          nameEn: "Duplicate Chargers",
          nameBn: "ডুপ্লিকেট চার্জার",
          level: 1,
        })
      ).rejects.toThrow(BusinessError);
    });

    it("enforces uniqueness on brand slugs", async () => {
      await catalogService.createBrand({
        name: "UGREEN",
        slug: "ugreen",
        isAuthorizedDistribution: true,
      });

      await expect(
        catalogService.createBrand({
          name: "UGREEN Copy",
          slug: "ugreen",
        })
      ).rejects.toThrow(BusinessError);
    });

    it("enforces uniqueness on product slugs and prevents collision on update", async () => {
      const cat = await catalogService.createCategory({
        slug: "power-banks",
        nameEn: "Power Banks",
        nameBn: "পাওয়ার ব্যাংক",
        level: 1,
      });

      const p1 = await catalogService.createProduct({
        slug: "ugreen-20000mah-pb",
        titleEn: "UGREEN 20000mAh Power Bank",
        titleBn: "ইউগ্রীন ২০০০০ এমএএইচ পাওয়ার ব্যাংক",
        categoryId: cat.id,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
      });

      // Duplicate on create
      await expect(
        catalogService.createProduct({
          slug: "ugreen-20000mah-pb",
          titleEn: "Another UGREEN PB",
          titleBn: "অন্য পাওয়ার ব্যাংক",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        })
      ).rejects.toThrow(BusinessError);

      const p2 = await catalogService.createProduct({
        slug: "baseus-20000mah-pb",
        titleEn: "Baseus 20000mAh Power Bank",
        titleBn: "বেসাস ২০০০০ এমএএইচ পাওয়ার ব্যাংক",
        categoryId: cat.id,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
      });

      // Duplicate on update
      await expect(
        catalogService.updateProduct(p2.id, {
          slug: "ugreen-20000mah-pb",
        })
      ).rejects.toThrow(BusinessError);

      expect(p1.id).toBeDefined();
    });

    it("transforms SKU code to uppercase and enforces uniqueness", async () => {
      const cat = await catalogService.createCategory({
        slug: "adapters",
        nameEn: "Adapters",
        nameBn: "অ্যাডাপ্টার",
        level: 1,
      });

      const product = await catalogService.createProduct({
        slug: "ugreen-65w-adapter",
        titleEn: "UGREEN 65W GaN Fast Charger",
        titleBn: "ইউগ্রীন ৬৫ ওয়াট গ্যান চার্জার",
        categoryId: cat.id,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
      });

      const sku = await catalogService.createSku({
        productId: product.id,
        skuCode: "ugr-65w-blk", // lowercase input
        pricePaisa: 320000,
        baseCostPaisa: 250000,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
      });

      expect(sku.skuCode).toBe("UGR-65W-BLK");

      // Colliding create with uppercase or lowercase
      await expect(
        catalogService.createSku({
          productId: product.id,
          skuCode: "UGR-65W-BLK",
          pricePaisa: 320000,
          baseCostPaisa: 250000,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
        })
      ).rejects.toThrow(BusinessError);
    });
  });

  describe("2. BUDGET_SMART Publish Rules & Zero-Replica Attestation", () => {
    it("blocks publishing of BUDGET_SMART product when zero_replica_attested is false", async () => {
      const cat = await catalogService.createCategory({
        slug: "cables-test",
        nameEn: "Cables Test",
        nameBn: "কেবল টেস্ট",
        level: 1,
      });

      const product = await catalogService.createProduct({
        slug: "budget-smart-100w-cable",
        titleEn: "Budget Smart 100W Braided Cable",
        titleBn: "বাজেট স্মার্ট ১০০ ওয়াট কেবল",
        categoryId: cat.id,
        productTier: "BUDGET_SMART",
        fulfillmentType: "DROP_AND_PACK",
        zeroReplicaAttested: false,
      });

      catalogService.setProductStatusForTesting(product.id, "APPROVED");

      await expect(
        catalogService.transitionProductStatus(product.id, {
          toStatus: "PUBLISHED",
          notes: "Attempt publish without zero replica attestation",
        })
      ).rejects.toThrow(/zero_replica_attested before publishing/);
    });

    it("allows publishing BUDGET_SMART once zero_replica_attested is true, and appends to status history", async () => {
      const cat = await catalogService.createCategory({
        slug: "chargers-test",
        nameEn: "Chargers Test",
        nameBn: "চার্জার টেস্ট",
        level: 1,
      });

      const product = await catalogService.createProduct({
        slug: "budget-smart-65w-gan",
        titleEn: "Budget Smart 65W GaN Charger",
        titleBn: "বাজেট স্মার্ট ৬৫ ওয়াট গ্যান চার্জার",
        categoryId: cat.id,
        productTier: "BUDGET_SMART",
        fulfillmentType: "DROP_AND_PACK",
        zeroReplicaAttested: false,
      });

      // Attest zero replica
      await catalogService.updateProduct(product.id, {
        zeroReplicaAttested: true,
      });

      catalogService.setProductStatusForTesting(product.id, "APPROVED");

      const published = await catalogService.transitionProductStatus(product.id, {
        toStatus: "PUBLISHED",
        notes: "Verified real OEM photos, packaging and safety chips",
      });

      expect(published.status).toBe("PUBLISHED");
      expect(published.publishedAt).toBeInstanceOf(Date);

      // Verify immutable status history
      const history = await catalogService.getProductStatusHistory(product.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0]?.toStatus).toBe("DRAFT");
      expect(history[history.length - 1]?.fromStatus).toBe("APPROVED");
      expect(history[history.length - 1]?.toStatus).toBe("PUBLISHED");
    });

    it("allows AUTHENTIC products to publish without zero_replica_attested", async () => {
      const cat = await catalogService.createCategory({
        slug: "auth-chargers",
        nameEn: "Auth Chargers",
        nameBn: "অথ চার্জার",
        level: 1,
      });

      const product = await catalogService.createProduct({
        slug: "ugreen-100w-desktop-station",
        titleEn: "UGREEN 100W Desktop Station",
        titleBn: "ইউগ্রীন ১০০ ওয়াট ডেস্কটপ স্টেশন",
        categoryId: cat.id,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        zeroReplicaAttested: false,
      });

      catalogService.setProductStatusForTesting(product.id, "APPROVED");

      const published = await catalogService.transitionProductStatus(product.id, {
        toStatus: "PUBLISHED",
      });

      expect(published.status).toBe("PUBLISHED");
    });

    it("blocks publishing for categories requiring BTRC clearance when btrc_status is not APPROVED", async () => {
      const wirelessCat = await catalogService.createCategory({
        slug: "wireless-mics",
        nameEn: "Wireless Microphones",
        nameBn: "ওয়্যারলেস মাইক্রোফোন",
        level: 1,
        btrcClearanceRequired: true,
      });

      const product = await catalogService.createProduct({
        slug: "wireless-lapel-mic-k9",
        titleEn: "K9 Wireless Lapel Mic",
        titleBn: "কে৯ ওয়্যারলেস ল্যাপেল মাইক",
        categoryId: wirelessCat.id,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        btrcStatus: "PENDING",
      });

      catalogService.setProductStatusForTesting(product.id, "APPROVED");

      await expect(
        catalogService.transitionProductStatus(product.id, {
          toStatus: "PUBLISHED",
        })
      ).rejects.toThrow(/BTRC clearance/);

      // Approve BTRC
      await catalogService.updateProduct(product.id, {
        btrcStatus: "APPROVED",
        btrcClearanceCode: "BTRC-NOC-2026-9921",
      });

      const published = await catalogService.transitionProductStatus(product.id, {
        toStatus: "PUBLISHED",
      });

      expect(published.status).toBe("PUBLISHED");
    });
  });

  describe("3. Dynamic Spec Validation Against Category Templates", () => {
    it("seeds PRD §3.1.3 templates (chargers, cables, audio) and validates against them", async () => {
      const seedResult = await catalogService.seedTemplates();
      expect(seedResult.categoriesSeeded).toBeGreaterThanOrEqual(3);

      const chargerCat = await catalogService.getCategoryBySlug("chargers-power");
      expect(chargerCat).toBeDefined();

      const fields = await catalogService.getCategorySpecFields(chargerCat!.id);
      expect(fields.length).toBeGreaterThanOrEqual(5);

      // 1. Valid charger specs
      const validSpecs = {
        output_wattage: 65,
        total_ports: 3,
        gan_technology: true,
        fast_charging_protocols: "PD 3.0, QC 4.0",
        safety_chips: "OVP, OCP, OTP",
      };

      const validated = await catalogService.validateSkuSpecs(chargerCat!.id, validSpecs);
      expect(validated.output_wattage).toBe(65);
      expect(validated.total_ports).toBe(3);

      // 2. Missing required field (output_wattage)
      const missingWattage = {
        total_ports: 2,
        gan_technology: false,
      };

      await expect(
        catalogService.validateSkuSpecs(chargerCat!.id, missingWattage)
      ).rejects.toThrow(ValidationError);

      // 3. Incorrect type (string instead of number for total_ports)
      const invalidType = {
        output_wattage: 100,
        total_ports: "two-ports-not-number",
      };

      await expect(
        catalogService.validateSkuSpecs(chargerCat!.id, invalidType)
      ).rejects.toThrow(ValidationError);
    });

    it("rejects SKU creation if specs violate category spec template", async () => {
      await catalogService.seedTemplates();
      const cableCat = await catalogService.getCategoryBySlug("cables");
      expect(cableCat).toBeDefined();

      const cableProduct = await catalogService.createProduct({
        slug: "ugreen-typec-cable-100w",
        titleEn: "UGREEN Type-C 100W Cable",
        titleBn: "ইউগ্রীন টাইপ-সি ১০০ ওয়াট কেবল",
        categoryId: cableCat!.id,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
      });

      // Cable template requires max_wattage and cable_length
      const invalidCableSpecs = {
        data_transfer_speed: "480 Mbps",
        // missing max_wattage and cable_length
      };

      await expect(
        catalogService.createSku({
          productId: cableProduct.id,
          skuCode: "UGR-C2C-100W-1M",
          pricePaisa: 65000,
          baseCostPaisa: 45000,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          specs: invalidCableSpecs,
        })
      ).rejects.toThrow(ValidationError);

      // Valid cable specs
      const validCableSpecs = {
        max_wattage: 100,
        cable_length: 1.5,
        data_transfer_speed: "480 Mbps",
        bend_test_rating: 15000,
      };

      const validSku = await catalogService.createSku({
        productId: cableProduct.id,
        skuCode: "UGR-C2C-100W-1M",
        pricePaisa: 65000,
        baseCostPaisa: 45000,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        specs: validCableSpecs,
      });

      expect(validSku.id).toBeDefined();
      expect(validSku.specs.max_wattage).toBe(100);
      expect(validSku.specs.cable_length).toBe(1.5);
    });
  });

  describe("4. Pricing, Buffer & Max Unit Purchase Computation", () => {
    it("computes max_unit_purchase_paisa based on base_cost_paisa and spot_buffer_bp", async () => {
      const cat = await catalogService.createCategory({
        slug: "tools",
        nameEn: "Tools",
        nameBn: "টুলস",
        level: 1,
      });

      const product = await catalogService.createProduct({
        slug: "uni-t-multimeter-ut33d",
        titleEn: "UNI-T Digital Multimeter UT33D+",
        titleBn: "ইউনি-টি ডিজিটাল মাল্টিমিটার",
        categoryId: cat.id,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
      });

      // Base cost: ৳2,000 (200,000 paisa)
      // Spot buffer: 600 bp (6.00%)
      // Buffer = 200,000 * 600 / 10,000 = 12,000 paisa
      // Max unit purchase = 200,000 + 12,000 = 212,000 paisa (৳2,120)
      const sku = await catalogService.createSku({
        productId: product.id,
        skuCode: "UNIT-UT33D-PLUS",
        pricePaisa: 280000,
        baseCostPaisa: 200000,
        spotBufferBp: 600,
        warrantyType: "SHOP_REPLACEMENT",
        warrantyDays: 180,
      });

      expect(sku.maxUnitPurchasePaisa).toBe(212000);
      expect(sku.warrantyDays).toBe(180);
      expect(sku.warrantyType).toBe("SHOP_REPLACEMENT");
    });
  });

  describe("5. Comparison Groups & Media Assets", () => {
    it("links comparison group to category and pairs authentic with budget alternatives", async () => {
      const cat = await catalogService.createCategory({
        slug: "fast-chargers-group-test",
        nameEn: "Fast Chargers",
        nameBn: "ফাস্ট চার্জার",
        level: 1,
      });

      const group = await catalogService.createComparisonGroup({
        name: "65W GaN Chargers Head-to-Head",
        categoryId: cat.id,
        verdictEn: "Authentic offers thermal safety headroom; Budget Smart provides unbeatable daily value.",
        badgeAuthenticLabel: "Full Safety Suite",
        badgeBudgetLabel: "Best Everyday Value",
      });

      expect(group.id).toBeDefined();
      expect(group.badgeAuthenticLabel).toBe("Full Safety Suite");
      expect(group.badgeBudgetLabel).toBe("Best Everyday Value");

      const authProduct = await catalogService.createProduct({
        slug: "ugreen-65w-authentic",
        titleEn: "UGREEN 65W GaN Charger",
        titleBn: "ইউগ্রীন ৬৫ ওয়াট গ্যান চার্জার",
        categoryId: cat.id,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        comparisonGroupId: group.id,
      });

      const budgetProduct = await catalogService.createProduct({
        slug: "budget-smart-65w-oem",
        titleEn: "Budget Smart 65W GaN Charger",
        titleBn: "বাজেট স্মার্ট ৬৫ ওয়াট গ্যান চার্জার",
        categoryId: cat.id,
        productTier: "BUDGET_SMART",
        fulfillmentType: "DROP_AND_PACK",
        comparisonGroupId: group.id,
        zeroReplicaAttested: true,
      });

      expect(authProduct.comparisonGroupId).toBe(group.id);
      expect(budgetProduct.comparisonGroupId).toBe(group.id);
    });

    it("creates, retrieves, and marks media assets ready for products", async () => {
      const media = await mediaService.createMediaAsset({
        ownerType: "PRODUCT",
        ownerId: "sample-prod-uuid",
        kind: "PRODUCT_IMAGE",
        bucket: "ncamart-media-dev",
        storageKey: "products/sample-prod/hero.webp",
        contentType: "image/webp",
        sizeBytes: 154200,
        width: 1200,
        height: 1200,
        isPrimary: true,
        uploadedByType: "STAFF",
        uploadedById: "staff-uuid-1",
      });

      expect(media.status).toBe("PENDING_UPLOAD");
      expect(media.isPrimary).toBe(true);

      const readyMedia = await mediaService.markMediaReady(media.id);
      expect(readyMedia?.status).toBe("READY");

      const readyList = await mediaService.listMediaByOwner("PRODUCT", "sample-prod-uuid");
      expect(readyList.length).toBe(1);
      expect(readyList[0]?.id).toBe(media.id);
    });
  });
});
