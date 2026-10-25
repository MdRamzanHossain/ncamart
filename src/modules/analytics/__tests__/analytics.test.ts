import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import {
  analyticsService,
  analyticsRepo,
  clearMemoryAnalyticsForTesting,
  setMockFeedItemsForTesting,
  setMockSitemapDataForTesting,
  buildGoogleMerchantXml,
  buildMetaCatalogCsv,
  hashEmailForMeta,
  hashPhoneForMeta,
  hashTextForMeta,
  sha256Hex,
  memSentPostHog,
  clearMemoryPostHogForTesting,
  memSentGA4,
  clearMemoryGA4ForTesting,
  memSentMeta,
  clearMemoryMetaForTesting,
  FeedProductItem,
} from "../index";
import { POST as analyticsEventsPost } from "@/app/api/v1/analytics/events/route";
import { GET as googleXmlGet } from "@/app/feeds/google.xml/route";
import { GET as metaCsvGet } from "@/app/feeds/meta.csv/route";
import { GET as sitemapEntriesGet } from "@/app/api/v1/seo/sitemap-entries/route";
import { clearMemoryStorageForTesting } from "@/lib/storage";

describe("P39 — Analytics Events & Marketing Feeds", () => {
  const sampleFeedItems: FeedProductItem[] = [
    {
      id: "01900000-0000-7000-8000-000000000001",
      skuCode: "ANK-65W-GAN",
      title: "Anker 65W GaN Fast Charger",
      description: "Ultra-fast compact GaN charger certified with holographic seal.",
      slug: "anker-65w-gan-fast-charger",
      pricePaisa: 385000,
      availability: "in_stock",
      brand: "Anker",
      barcodeEan13: "848061000011",
      tier: "AUTHENTIC",
      imageUrl: "https://cdn.ncamart.com/products/anker-65w-gan/main.webp",
    },
    {
      id: "01900000-0000-7000-8000-000000000002",
      skuCode: "BASE-20W-CBL",
      title: "Baseus 20W Type-C to Lightning Cable",
      description: "Durable braided fast charging cable for iOS devices.",
      slug: "baseus-20w-type-c-lightning-cable",
      pricePaisa: 65000,
      availability: "in_stock",
      brand: "Baseus",
      barcodeEan13: "695315620002",
      tier: "BUDGET_SMART",
      imageUrl: "https://cdn.ncamart.com/products/baseus-20w-cable/main.webp",
    },
    {
      id: "01900000-0000-7000-8000-000000000003",
      skuCode: "ORAI-ANC-PRE",
      title: "Oraimo SpacePods Pro ANC",
      description: "Pre-order authentic active noise cancelling earbuds.",
      slug: "oraimo-spacepods-pro-anc",
      pricePaisa: 520000,
      availability: "preorder",
      brand: "Oraimo",
      barcodeEan13: null,
      tier: "AUTHENTIC",
      imageUrl: "https://cdn.ncamart.com/products/oraimo-spacepods/main.webp",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    clearMemoryAnalyticsForTesting();
    clearMemoryPostHogForTesting();
    clearMemoryGA4ForTesting();
    clearMemoryMetaForTesting();
    clearMemoryStorageForTesting();
    setMockFeedItemsForTesting(sampleFeedItems);
  });

  // =========================================================================
  // 1. Marketing Feeds Structure & Snapshot Validation
  // =========================================================================
  describe("1. Marketing Feeds Generation", () => {
    it("generates Google Merchant XML complying with RSS 2.0 g: namespace specification", () => {
      const xml = buildGoogleMerchantXml(sampleFeedItems, "https://ncamart.com");

      // Valid XML header & RSS channel
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
      expect(xml).toContain("<title>NCAMart Products</title>");
      expect(xml).toContain("<link>https://ncamart.com</link>");

      // First Item: Authentic Anker Charger
      expect(xml).toContain("<g:id>ANK-65W-GAN</g:id>");
      expect(xml).toContain("<g:title>Anker 65W GaN Fast Charger</g:title>");
      expect(xml).toContain("<g:price>3850.00 BDT</g:price>");
      expect(xml).toContain("<g:availability>in_stock</g:availability>");
      expect(xml).toContain("<g:brand>Anker</g:brand>");
      expect(xml).toContain("<g:gtin>848061000011</g:gtin>");
      expect(xml).toContain("<g:condition>new</g:condition>");
      expect(xml).toContain("<g:custom_label_0>AUTHENTIC</g:custom_label_0>");

      // Second Item: Budget Smart Cable
      expect(xml).toContain("<g:id>BASE-20W-CBL</g:id>");
      expect(xml).toContain("<g:price>650.00 BDT</g:price>");
      expect(xml).toContain("<g:custom_label_0>BUDGET_SMART</g:custom_label_0>");

      // Third Item: Pre-Order item without barcode -> identifier_exists: no
      expect(xml).toContain("<g:id>ORAI-ANC-PRE</g:id>");
      expect(xml).toContain("<g:availability>preorder</g:availability>");
      expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>");

      // Snapshot validation
      expect(xml).toMatchSnapshot();
    });

    it("generates Meta Catalog CSV complying with Meta product feed specification", () => {
      const csv = buildMetaCatalogCsv(sampleFeedItems, "https://ncamart.com");
      const lines = csv.split("\n");

      // Verify exact header
      expect(lines[0]).toBe(
        "id,title,description,availability,condition,price,link,image_link,brand,custom_label_0"
      );

      // Verify row count (header + 3 items)
      expect(lines.length).toBe(4);

      // Verify row 1 contains formatted fields
      expect(lines[1]).toContain('"ANK-65W-GAN"');
      expect(lines[1]).toContain('"Anker 65W GaN Fast Charger"');
      expect(lines[1]).toContain('"in stock"');
      expect(lines[1]).toContain('"3850.00 BDT"');
      expect(lines[1]).toContain('"Anker"');
      expect(lines[1]).toContain('"AUTHENTIC"');

      // Verify preorder row
      expect(lines[3]).toContain('"ORAI-ANC-PRE"');
      expect(lines[3]).toContain('"preorder"');
      expect(lines[3]).toContain('"5200.00 BDT"');

      // Snapshot validation
      expect(csv).toMatchSnapshot();
    });

    it("executes the hourly feed job, uploads both feeds to R2, and serves them via HTTP routes", async () => {
      const result = await analyticsService.generateAndUploadFeeds();

      expect(result.productsCount).toBe(3);
      expect(result.googleXmlBytes).toBeGreaterThan(0);
      expect(result.metaCsvBytes).toBeGreaterThan(0);

      // Test GET /feeds/google.xml
      const reqXml = new NextRequest("http://localhost:3000/feeds/google.xml");
      const resXml = await googleXmlGet(reqXml);
      expect(resXml.status).toBe(200);
      expect(resXml.headers.get("content-type")).toContain("application/xml");
      expect(resXml.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");
      const bodyXml = await resXml.text();
      expect(bodyXml).toContain("<rss version=\"2.0\"");

      // Test GET /feeds/meta.csv
      const reqCsv = new NextRequest("http://localhost:3000/feeds/meta.csv");
      const resCsv = await metaCsvGet(reqCsv);
      expect(resCsv.status).toBe(200);
      expect(resCsv.headers.get("content-type")).toContain("text/csv");
      expect(resCsv.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");
      const bodyCsv = await resCsv.text();
      expect(bodyCsv).toContain("id,title,description,availability");
    });
  });

  // =========================================================================
  // 2. Meta Conversions API (CAPI) PII Hashing Verification
  // =========================================================================
  describe("2. Meta Conversions API (CAPI) PII Hashing", () => {
    it("hashes email addresses per Meta CAPI specification (lowercase, trimmed, SHA-256 hex)", () => {
      const email = "  User.Name@Example.COM  ";
      const expectedNormalized = "user.name@example.com";
      const expectedHash = crypto.createHash("sha256").update(expectedNormalized).digest("hex");

      const hashed = hashEmailForMeta(email);
      expect(hashed).toBe(expectedHash);
    });

    it("normalizes and hashes Bangladesh phone numbers per Meta CAPI specification", () => {
      // 1. Phone with formatting and +880
      const phone1 = "+880 1711-223344";
      const expectedDigits1 = "8801711223344";
      const expectedHash1 = crypto.createHash("sha256").update(expectedDigits1).digest("hex");
      expect(hashPhoneForMeta(phone1)).toBe(expectedHash1);

      // 2. Local Bangladeshi format with leading 0 (01812345678 -> 8801812345678)
      const phone2 = "01812-345678";
      const expectedDigits2 = "8801812345678";
      const expectedHash2 = crypto.createHash("sha256").update(expectedDigits2).digest("hex");
      expect(hashPhoneForMeta(phone2)).toBe(expectedHash2);
    });

    it("verifies Meta CAPI payload contains only hashed PII and never plaintext values", async () => {
      const rawEmail = "customer@ncamart.com";
      const rawPhone = "01799887766";
      const rawCity = "Dhaka";

      await analyticsService.trackClientEvent({
        event_name: "checkout_started",
        properties: {
          email: rawEmail,
          phone: rawPhone,
          city: rawCity,
          total: 4500,
          currency: "BDT",
        },
        consent: {
          analytics: true,
          marketing: true,
        },
        user_id: "cust-meta-test-01",
      });

      expect(memSentMeta.length).toBe(1);
      const metaRecord = memSentMeta[0];

      // Event Name mapped to Meta Standard Event
      expect(metaRecord.eventName).toBe("InitiateCheckout");

      // Verify hashed user_data
      const expectedEmailHash = hashEmailForMeta(rawEmail);
      const expectedPhoneHash = hashPhoneForMeta(rawPhone);
      const expectedCityHash = hashTextForMeta(rawCity);

      expect(metaRecord.userData.em).toEqual([expectedEmailHash]);
      expect(metaRecord.userData.ph).toEqual([expectedPhoneHash]);
      expect(metaRecord.userData.ct).toEqual([expectedCityHash]);

      // CRITICAL SECURITY ASSERTION: No plaintext email or phone exists anywhere in userData
      const serializedUserData = JSON.stringify(metaRecord.userData);
      expect(serializedUserData).not.toContain(rawEmail);
      expect(serializedUserData).not.toContain(rawPhone);
    });
  });

  // =========================================================================
  // 3. Consent Filtering & Event Pipeline
  // =========================================================================
  describe("3. Consent Filtering & Event Pipeline", () => {
    it("forwards events to third parties (PostHog, GA4, Meta) when consent.analytics is true", async () => {
      const res = await analyticsService.trackClientEvent({
        event_name: "product_view",
        properties: {
          productId: "prod-1",
          tier: "AUTHENTIC",
          price: 3850,
        },
        consent: {
          analytics: true,
          marketing: true,
        },
        user_id: "user-101",
      });

      expect(res.accepted).toBe(true);
      expect(res.consentStatus).toBe("GRANTED");
      expect(res.forwardedTo).toEqual(["POSTHOG", "GA4", "META"]);

      // Verify all 3 providers received the tracking call
      expect(memSentPostHog.length).toBe(1);
      expect(memSentPostHog[0].event).toBe("product_view");
      expect(memSentPostHog[0].properties.tier).toBe("AUTHENTIC");

      expect(memSentGA4.length).toBe(1);
      expect(memSentGA4[0].eventName).toBe("product_view");

      expect(memSentMeta.length).toBe(1);
      expect(memSentMeta[0].eventName).toBe("ViewContent");
    });

    it("drops third-party forwarding when analytics consent is false, recording internal decision", async () => {
      const res = await analyticsService.trackClientEvent({
        event_name: "add_to_cart",
        properties: {
          skuId: "sku-1",
          quantity: 2,
        },
        consent: {
          analytics: false,
          marketing: false,
        },
        anonymous_id: "anon-404",
      });

      expect(res.accepted).toBe(true);
      expect(res.consentStatus).toBe("DENIED");
      expect(res.forwardedTo).toEqual([]);

      // Third parties must NOT receive calls
      expect(memSentPostHog.length).toBe(0);
      expect(memSentGA4.length).toBe(0);
      expect(memSentMeta.length).toBe(0);

      // Stored in internal analytics_events table with decision recorded
      const internalEvents = await analyticsRepo.listEvents(undefined, {
        eventName: "add_to_cart",
      });
      expect(internalEvents.total).toBe(1);
      expect(internalEvents.items[0].consentStatus).toBe("DENIED");
      expect(internalEvents.items[0].forwardedTo).toEqual([]);
    });

    it("rejects non-whitelisted client events with 422 Unprocessable Entity", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "custom_unauthorized_event",
          properties: {},
          consent: { analytics: true },
        }),
      });

      const res = await analyticsEventsPost(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toBe("REJECTED_EVENT");
    });

    it("ingests server outbox events (order.placed) as strictly-necessary server KPIs", async () => {
      const outboxEvent = {
        type: "order.placed",
        aggregateType: "ORDER",
        aggregateId: "ord-2026-001",
        payload: {
          orderNumber: "ORD-2026-001",
          total: 5500,
          currency: "BDT",
          customerId: "cust-55",
          // No explicit client analytics consent flag passed from backend
        },
      };

      const result = await analyticsService.handleOutboxEvent(outboxEvent);

      expect(result.processed).toBe(true);
      expect(result.eventName).toBe("order_placed");
      expect(result.consentStatus).toBe("STRICTLY_NECESSARY");
      expect(result.forwardedTo).toEqual([]);

      // Third parties received no calls
      expect(memSentPostHog.length).toBe(0);
      expect(memSentGA4.length).toBe(0);
      expect(memSentMeta.length).toBe(0);

      // Stored internally for KPI accounting
      const internalEvents = await analyticsRepo.listEvents(undefined, {
        eventName: "order_placed",
      });
      expect(internalEvents.total).toBe(1);
      expect(internalEvents.items[0].consentStatus).toBe("STRICTLY_NECESSARY");
    });
  });

  // =========================================================================
  // 4. Sitemap Entries Endpoint
  // =========================================================================
  describe("4. Sitemap Data Endpoint (GET /api/v1/seo/sitemap-entries)", () => {
    it("returns sitemap entries with product and category alternates for bn and en", async () => {
      setMockSitemapDataForTesting({
        products: [
          { slug: "anker-65w-gan-fast-charger", updatedAt: new Date("2026-10-20T10:00:00Z") },
        ],
        categories: [
          { slug: "chargers-adapters", updatedAt: new Date("2026-10-01T00:00:00Z") },
        ],
      });

      const req = new NextRequest("http://localhost:3000/api/v1/seo/sitemap-entries");
      const res = await sitemapEntriesGet(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");

      const json = await res.json();
      expect(json.total).toBe(3); // Homepage + Category + Product

      const baseUrl = json.entries[0].loc.replace(/\/$/, "");

      // Verify category entry alternates
      const catEntry = json.entries.find((e: any) => e.loc.includes("/categories/chargers-adapters"));
      expect(catEntry).toBeDefined();
      expect(catEntry.alternates).toEqual([
        { lang: "bn", href: `${baseUrl}/catalog/categories/chargers-adapters` },
        { lang: "en", href: `${baseUrl}/en/catalog/categories/chargers-adapters` },
      ]);

      // Verify product entry alternates
      const prodEntry = json.entries.find((e: any) => e.loc.includes("/products/anker-65w-gan-fast-charger"));
      expect(prodEntry).toBeDefined();
      expect(prodEntry.alternates).toEqual([
        { lang: "bn", href: `${baseUrl}/catalog/products/anker-65w-gan-fast-charger` },
        { lang: "en", href: `${baseUrl}/en/catalog/products/anker-65w-gan-fast-charger` },
      ]);
    });
  });
});
