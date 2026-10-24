import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  searchService,
  normalizeBanglaDigits,
  normalizeSearchQuery,
  SEARCH_SYNONYMS,
  buildMeiliSynonyms,
  setMeiliClientForTest,
  PRODUCTS_INDEX,
} from "../index";
import {
  handleProductPublished,
  handleProductUpdated,
  handleProductArchived,
} from "../events";
import { catalogService } from "@/modules/catalog";
import { Actor } from "@/lib/http/route";
import { OutboxRow } from "@/db/infra";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/catalog/search/route";

describe("Search Module (Meilisearch, Bangla, English, Banglish) — P12", () => {
  const staffActor: Actor = {
    id: "admin-actor-uuid",
    type: "staff",
    roles: ["SUPER_ADMIN"],
  };

  beforeEach(() => {
    catalogService.clearMemoryCatalogForTesting();
    searchService.clearMemorySearchForTesting();
    setMeiliClientForTest(null);
  });

  describe("1. Synonyms & Bangla Query Normalization", () => {
    it("normalizes Bangla digits to Latin digits correctly", () => {
      expect(normalizeBanglaDigits("০১২৩৪৫৬৭৮৯")).toBe("0123456789");
      expect(normalizeBanglaDigits("৬৫ ওয়াট")).toBe("65 ওয়াট");
      expect(normalizeBanglaDigits("৳১২০০")).toBe("৳1200");
    });

    it("normalizes '৬৫ ওয়াট' to '65 w'", () => {
      const normalized = normalizeSearchQuery("৬৫ ওয়াট");
      expect(normalized).toBe("65 w");
    });

    it("normalizes units and extra spaces", () => {
      expect(normalizeSearchQuery("  ২০   ওয়াট  ")).toBe("20 w");
      expect(normalizeSearchQuery("৫ ভোল্ট")).toBe("5 v");
      expect(normalizeSearchQuery("২ অ্যাম্পিয়ার")).toBe("2 a");
      expect(normalizeSearchQuery("১০০০০ এমএএইচ")).toBe("10000 mah");
    });

    it("verifies bidirectional synonyms dictionary (bn ↔ en ↔ Banglish)", () => {
      // charger ↔ চার্জার ↔ charjar
      expect(SEARCH_SYNONYMS["charger"]).toContain("চার্জার");
      expect(SEARCH_SYNONYMS["charger"]).toContain("charjar");
      expect(SEARCH_SYNONYMS["চার্জার"]).toContain("charger");
      expect(SEARCH_SYNONYMS["চার্জার"]).toContain("charjar");
      expect(SEARCH_SYNONYMS["charjar"]).toContain("charger");
      expect(SEARCH_SYNONYMS["charjar"]).toContain("চার্জার");

      // cable ↔ ক্যাবল ↔ kebol
      expect(SEARCH_SYNONYMS["cable"]).toContain("ক্যাবল");
      expect(SEARCH_SYNONYMS["cable"]).toContain("kebol");
      expect(SEARCH_SYNONYMS["ক্যাবল"]).toContain("cable");

      // power bank ↔ পাওয়ার ব্যাংক ↔ powerbank
      expect(SEARCH_SYNONYMS["power bank"]).toContain("পাওয়ার ব্যাংক");
      expect(SEARCH_SYNONYMS["power bank"]).toContain("powerbank");

      // multimeter ↔ মাল্টিমিটার
      expect(SEARCH_SYNONYMS["multimeter"]).toContain("মাল্টিমিটার");
      expect(SEARCH_SYNONYMS["মাল্টিমিটার"]).toContain("multimeter");

      // smart lock ↔ স্মার্ট লক
      expect(SEARCH_SYNONYMS["smart lock"]).toContain("স্মার্ট লক");
      expect(SEARCH_SYNONYMS["স্মার্ট লক"]).toContain("smart lock");

      // earbuds ↔ ইয়ারবাড ↔ airbuds
      expect(SEARCH_SYNONYMS["earbuds"]).toContain("ইয়ারবাড");
      expect(SEARCH_SYNONYMS["earbuds"]).toContain("airbuds");
    });

    it("buildMeiliSynonyms creates clean bidirectional maps without self-loops", () => {
      const testGroups = [["alpha", "beta", "gamma"]];
      const result = buildMeiliSynonyms(testGroups);
      expect(result["alpha"]).toEqual(["beta", "gamma"]);
      expect(result["beta"]).toEqual(["alpha", "gamma"]);
      expect(result["gamma"]).toEqual(["alpha", "beta"]);
      expect(result["alpha"]).not.toContain("alpha");
    });
  });

  describe("2. Search Queries & Matching (Synonyms, Typo Tolerance, ILIKE Fallback)", () => {
    async function seedTestProducts() {
      const cat = await catalogService.createCategory({
        slug: "chargers",
        nameEn: "Chargers & Power",
        nameBn: "চার্জার ও পাওয়ার",
        level: 1,
      });

      const brandAnker = await catalogService.createBrand({
        name: "Anker",
        slug: "anker",
      });

      const brandBaseus = await catalogService.createBrand({
        name: "Baseus",
        slug: "baseus",
      });

      // Product 1: Anker 65W GaN Fast Charger (English title)
      const prod1 = await catalogService.createProduct(
        {
          slug: "anker-65w-gan-charger",
          titleEn: "Anker 65W GaN Fast Charger",
          titleBn: "অ্যাঙ্কার ফাস্ট অ্যাডাপ্টার",
          categoryId: cat.id,
          brandId: brandAnker.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
          comparisonPointsEn: ["65W Fast Charging", "Foldable Plug"],
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: prod1.id,
          skuCode: "ANK-65W-BLK",
          pricePaisa: 280000,
          baseCostPaisa: 200000,
          specs: { wattage: "65W", ports: "USB-C + USB-A" },
          weightGrams: 120,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          warrantyDays: 365,
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(prod1.id, "APPROVED");
      const pubProd1 = await catalogService.publishProduct(prod1.id, staffActor);

      // Product 2: Baseus Type-C Cable
      const prod2 = await catalogService.createProduct(
        {
          slug: "baseus-type-c-cable",
          titleEn: "Baseus Braided USB-C Cable 100W",
          titleBn: "বেসিয়াস ইউএসবি-সি ক্যাবল ১০০ ওয়াট",
          categoryId: cat.id,
          brandId: brandBaseus.id,
          productTier: "BUDGET_SMART",
          fulfillmentType: "DROP_AND_PACK",
          zeroReplicaAttested: true,
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: prod2.id,
          skuCode: "BAS-100W-CBL",
          pricePaisa: 65000,
          baseCostPaisa: 40000,
          specs: { wattage: "100W", length: "1.2m" },
          weightGrams: 40,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 30,
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(prod2.id, "APPROVED");
      const pubProd2 = await catalogService.publishProduct(prod2.id, staffActor);

      return { cat, brandAnker, brandBaseus, pubProd1, pubProd2 };
    }

    it("finds English-titled product via Bangla query using synonyms ('চার্জার' -> charger)", async () => {
      await seedTestProducts();

      // Search with Bangla query "চার্জার"
      const result = await searchService.search({
        q: "চার্জার",
        page: 1,
        limit: 20,
      });

      expect(result.hits.length).toBeGreaterThanOrEqual(1);
      const hit = result.hits.find((h) => h.slug === "anker-65w-gan-charger");
      expect(hit).toBeDefined();
      expect(hit?.title_en).toBe("Anker 65W GaN Fast Charger");
      expect(hit?._formatted).toBeDefined();
    });

    it("finds English-titled product via Banglish query ('charjar' -> charger)", async () => {
      await seedTestProducts();

      const result = await searchService.search({
        q: "charjar",
        page: 1,
        limit: 20,
      });

      expect(result.hits.length).toBeGreaterThanOrEqual(1);
      const hit = result.hits.find((h) => h.slug === "anker-65w-gan-charger");
      expect(hit).toBeDefined();
    });

    it("finds product with Bangla digits normalization ('৬৫ ওয়াট' -> 65W)", async () => {
      await seedTestProducts();

      const result = await searchService.search({
        q: "৬৫ ওয়াট",
        page: 1,
        limit: 20,
      });

      expect(result.hits.length).toBeGreaterThanOrEqual(1);
      const hit = result.hits.find((h) => h.slug === "anker-65w-gan-charger");
      expect(hit).toBeDefined();
    });

    it("finds product despite typo ('chrager' -> charger)", async () => {
      await seedTestProducts();

      const result = await searchService.search({
        q: "chrager",
        page: 1,
        limit: 20,
      });

      expect(result.hits.length).toBeGreaterThanOrEqual(1);
      const hit = result.hits.find((h) => h.slug === "anker-65w-gan-charger");
      expect(hit).toBeDefined();
    });

    it("filters by tier (AUTHENTIC vs BUDGET_SMART)", async () => {
      await seedTestProducts();

      const authenticResult = await searchService.search({
        tier: "AUTHENTIC",
        page: 1,
        limit: 20,
      });

      expect(authenticResult.hits.length).toBe(1);
      expect(authenticResult.hits[0]!.tier).toBe("AUTHENTIC");

      const budgetResult = await searchService.search({
        tier: "BUDGET_SMART",
        page: 1,
        limit: 20,
      });

      expect(budgetResult.hits.length).toBe(1);
      expect(budgetResult.hits[0]!.tier).toBe("BUDGET_SMART");
    });

    it("filters by brand and category", async () => {
      const { cat } = await seedTestProducts();

      const result = await searchService.search({
        brand: "Anker",
        category: cat.id,
        page: 1,
        limit: 20,
      });

      expect(result.hits.length).toBe(1);
      expect(result.hits[0]!.brand).toBe("Anker");
    });

    it("returns facet distribution for tier, brand, and category", async () => {
      await seedTestProducts();

      const result = await searchService.search({
        page: 1,
        limit: 20,
      });

      expect(result.facets.tier["AUTHENTIC"]).toBe(1);
      expect(result.facets.tier["BUDGET_SMART"]).toBe(1);
      expect(result.facets.brand["Anker"]).toBe(1);
      expect(result.facets.brand["Baseus"]).toBe(1);
      expect(Object.keys(result.facets.category).length).toBeGreaterThanOrEqual(1);
    });

    it("formats highlight tags in _formatted", async () => {
      await seedTestProducts();

      const result = await searchService.search({
        q: "Anker",
        page: 1,
        limit: 20,
      });

      expect(result.hits.length).toBe(1);
      const formatted = result.hits[0]!._formatted;
      expect(formatted).toBeDefined();
      expect(formatted?.title_en).toContain("<em>Anker</em>");
      expect(formatted?.brand).toContain("<em>Anker</em>");
    });
  });

  describe("3. Atomic Reindex & Swap", () => {
    it("full rebuild executes and performs atomic swap", async () => {
      const cat = await catalogService.createCategory({
        slug: "audio",
        nameEn: "Audio",
        nameBn: "অডিও",
        level: 1,
      });
      const prod = await catalogService.createProduct(
        {
          slug: "test-earbuds",
          titleEn: "Wireless Earbuds Pro",
          titleBn: "ওয়্যারলেস ইয়ারবাড প্রো",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: prod.id,
          skuCode: "EAR-PRO-01",
          pricePaisa: 350000,
          baseCostPaisa: 250000,
          weightGrams: 60,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 180,
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(prod.id, "APPROVED");
      await catalogService.publishProduct(prod.id, staffActor);

      // Execute full reindex
      const reindexResult = await searchService.reindexAll();
      expect(reindexResult.indexedCount).toBe(1);
      expect(reindexResult.targetIndex).toBeDefined();

      // Verify searchable via memory fallback
      const searchRes = await searchService.search({ q: "earbuds" });
      expect(searchRes.hits.length).toBe(1);
      expect(searchRes.hits[0]!.slug).toBe("test-earbuds");
    });

    it("verifies mock Meilisearch swapIndexes call when client is active", async () => {
      const swapMock = vi.fn().mockResolvedValue({ taskUid: 99 });
      const waitForTaskMock = vi.fn().mockResolvedValue({ status: "succeeded" });
      const addDocumentsMock = vi.fn().mockResolvedValue({ taskUid: 101 });
      const updateSettingsMock = vi.fn().mockResolvedValue({ taskUid: 102 });
      const deleteIndexMock = vi.fn().mockResolvedValue({ taskUid: 103 });

      const mockIndex = {
        getRawInfo: vi.fn().mockResolvedValue({ uid: "products" }),
        updateSettings: updateSettingsMock,
        addDocuments: addDocumentsMock,
        deleteDocument: vi.fn().mockResolvedValue({ taskUid: 104 }),
      };

      const mockMeili = {
        isHealthy: vi.fn().mockResolvedValue(true),
        index: vi.fn().mockReturnValue(mockIndex),
        createIndex: vi.fn().mockResolvedValue({ taskUid: 105 }),
        swapIndexes: swapMock,
        waitForTask: waitForTaskMock,
        tasks: {
          waitForTask: waitForTaskMock,
        },
        deleteIndex: deleteIndexMock,
      };

      setMeiliClientForTest(mockMeili as unknown as import("meilisearch").Meilisearch);

      const cat = await catalogService.createCategory({
        slug: "multimeters",
        nameEn: "Digital Multimeter",
        nameBn: "ডিজিটাল মাল্টিমিটার",
        level: 1,
      });
      const prod = await catalogService.createProduct(
        {
          slug: "pro-multimeter",
          titleEn: "Pro Auto-ranging Multimeter",
          titleBn: "প্রো অটো-রেঞ্জিং মাল্টিমিটার",
          categoryId: cat.id,
          productTier: "BUDGET_SMART",
          fulfillmentType: "DROP_AND_PACK",
          zeroReplicaAttested: true,
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: prod.id,
          skuCode: "MULTI-01",
          pricePaisa: 150000,
          baseCostPaisa: 90000,
          weightGrams: 200,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 90,
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(prod.id, "APPROVED");
      await catalogService.publishProduct(prod.id, staffActor);

      const res = await searchService.reindexAll();
      expect(res.indexedCount).toBe(1);
      expect(res.targetIndex).toBe(PRODUCTS_INDEX);
      expect(swapMock).toHaveBeenCalledTimes(1);
      expect(deleteIndexMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("4. Outbox Handlers (Publication, Update, Archival)", () => {
    it("indexes on product_published and deletes on product_archived", async () => {
      const cat = await catalogService.createCategory({
        slug: "smart-locks",
        nameEn: "Smart Lock",
        nameBn: "স্মার্ট লক",
        level: 1,
      });
      const prod = await catalogService.createProduct(
        {
          slug: "fingerprint-smart-lock",
          titleEn: "Biometric Fingerprint Smart Lock",
          titleBn: "বায়োমেট্রিক স্মার্ট লক",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: prod.id,
          skuCode: "LOCK-FP-01",
          pricePaisa: 850000,
          baseCostPaisa: 600000,
          weightGrams: 1500,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 365,
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(prod.id, "APPROVED");
      const published = await catalogService.publishProduct(prod.id, staffActor);

      // Verify outbox handler index upsert
      const pubEvent: OutboxRow = {
        id: "evt-pub-1",
        type: "catalog.product_published",
        aggregateType: "product",
        aggregateId: published.id,
        payload: { productId: published.id },
        notificationClass: null,
        availableAt: new Date(),
        createdAt: new Date(),
        publishedAt: null,
        attempts: 0,
        lastError: null,
      };
      await handleProductPublished(pubEvent);

      expect(searchService.getMemoryDocumentForTesting(published.id)).toBeDefined();

      // Update event
      const updEvent: OutboxRow = {
        id: "evt-upd-1",
        type: "catalog.product_updated",
        aggregateType: "product",
        aggregateId: published.id,
        payload: { productId: published.id },
        notificationClass: null,
        availableAt: new Date(),
        createdAt: new Date(),
        publishedAt: null,
        attempts: 0,
        lastError: null,
      };
      await handleProductUpdated(updEvent);
      expect(searchService.getMemoryDocumentForTesting(published.id)).toBeDefined();

      // Archival event
      const archEvent: OutboxRow = {
        id: "evt-arch-1",
        type: "catalog.product_archived",
        aggregateType: "product",
        aggregateId: published.id,
        payload: { productId: published.id },
        notificationClass: null,
        availableAt: new Date(),
        createdAt: new Date(),
        publishedAt: null,
        attempts: 0,
        lastError: null,
      };
      await handleProductArchived(archEvent);
      expect(searchService.getMemoryDocumentForTesting(published.id)).toBeNull();
    });
  });

  describe("5. Route Handler GET /api/v1/catalog/search", () => {
    it("responds with hits, facets, and pagination headers", async () => {
      const cat = await catalogService.createCategory({
        slug: "adapters",
        nameEn: "Power Adapters",
        nameBn: "পাওয়ার অ্যাডাপ্টার",
        level: 1,
      });
      const prod = await catalogService.createProduct(
        {
          slug: "travel-adapter-65w",
          titleEn: "Universal Travel Adapter 65W",
          titleBn: "ট্রাভেল অ্যাডাপ্টার",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );
      await catalogService.createSku(
        {
          productId: prod.id,
          skuCode: "TRV-65W",
          pricePaisa: 220000,
          baseCostPaisa: 150000,
          weightGrams: 90,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 180,
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(prod.id, "APPROVED");
      await catalogService.publishProduct(prod.id, staffActor);

      const req = new NextRequest("http://localhost:3000/api/v1/catalog/search?q=adapter&tier=AUTHENTIC&page=1&limit=10");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.hits).toBeDefined();
      expect(body.hits.length).toBe(1);
      expect(body.facets).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
    });
  });
});
