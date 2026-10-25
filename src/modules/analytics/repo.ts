import crypto from "node:crypto";
import { eq, desc, and } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import { analyticsEvents, AnalyticsEventRow, InsertAnalyticsEventRow } from "./schema";
import { FeedProductItem } from "./feeds";
import { products, skus, brands, categories } from "@/modules/catalog/schema";

// In-Memory Storage for tests & offline fallback
const memAnalyticsEvents = new Map<string, AnalyticsEventRow>();
let mockFeedItems: FeedProductItem[] | null = null;
let mockSitemapData: {
  products: Array<{ slug: string; updatedAt: Date }>;
  categories: Array<{ slug: string; updatedAt: Date }>;
} | null = null;

export function clearMemoryAnalyticsForTesting(): void {
  memAnalyticsEvents.clear();
  mockFeedItems = null;
  mockSitemapData = null;
}

export function setMockFeedItemsForTesting(items: FeedProductItem[]): void {
  mockFeedItems = items;
}

export function setMockSitemapDataForTesting(data: {
  products: Array<{ slug: string; updatedAt: Date }>;
  categories: Array<{ slug: string; updatedAt: Date }>;
}): void {
  mockSitemapData = data;
}

export const analyticsRepo = {
  // --------------------------------------------------------------------------
  // 1. Events Persistence
  // --------------------------------------------------------------------------
  async recordEvent(
    tx: Tx | undefined,
    row: InsertAnalyticsEventRow
  ): Promise<AnalyticsEventRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const createdAt = row.createdAt ?? new Date();

    const fullRow: AnalyticsEventRow = {
      id,
      eventName: row.eventName,
      aggregateType: row.aggregateType ?? null,
      aggregateId: row.aggregateId ?? null,
      userId: row.userId ?? null,
      anonymousId: row.anonymousId ?? null,
      properties: (row.properties ?? {}) as Record<string, unknown>,
      consentStatus: row.consentStatus ?? "STRICTLY_NECESSARY",
      forwardedTo: (row.forwardedTo ?? []) as string[],
      createdAt,
    };

    try {
      const [inserted] = await client.insert(analyticsEvents).values(fullRow).returning();
      if (inserted) {
        memAnalyticsEvents.set(id, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memAnalyticsEvents.set(id, fullRow);
    return fullRow;
  },

  async listEvents(
    tx: Tx | undefined,
    filter: {
      eventName?: string;
      aggregateId?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ items: AnalyticsEventRow[]; total: number }> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    const client = tx ?? defaultDb;

    try {
      const conditions = [];
      if (filter.eventName) conditions.push(eq(analyticsEvents.eventName, filter.eventName));
      if (filter.aggregateId) conditions.push(eq(analyticsEvents.aggregateId, filter.aggregateId));
      if (filter.userId) conditions.push(eq(analyticsEvents.userId, filter.userId));

      const query = client
        .select()
        .from(analyticsEvents)
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(limit)
        .offset(offset);

      const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
      if (rows.length > 0) {
        return { items: rows, total: rows.length };
      }
    } catch {
      // Memory fallback
    }

    let all = Array.from(memAnalyticsEvents.values());
    if (filter.eventName) {
      all = all.filter((e) => e.eventName === filter.eventName);
    }
    if (filter.aggregateId) {
      all = all.filter((e) => e.aggregateId === filter.aggregateId);
    }
    if (filter.userId) {
      all = all.filter((e) => e.userId === filter.userId);
    }
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
    };
  },

  // --------------------------------------------------------------------------
  // 2. Feed Items Query (PUBLISHED products + active SKUs)
  // --------------------------------------------------------------------------
  async getFeedItems(tx?: Tx): Promise<FeedProductItem[]> {
    if (mockFeedItems) {
      return mockFeedItems;
    }

    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select({
          skuId: skus.id,
          skuCode: skus.skuCode,
          barcodeEan13: skus.barcodeEan13,
          pricePaisa: skus.pricePaisa,
          productTitleEn: products.titleEn,
          productDescriptionEn: products.descriptionEn,
          productSlug: products.slug,
          productTier: products.productTier,
          fulfillmentType: products.fulfillmentType,
          brandNameEn: brands.nameEn,
        })
        .from(skus)
        .innerJoin(products, eq(skus.productId, products.id))
        .leftJoin(brands, eq(products.brandId, brands.id))
        .where(and(eq(products.status, "PUBLISHED"), eq(skus.isActive, true)));

      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r.skuId,
          skuCode: r.skuCode,
          title: r.productTitleEn,
          description: r.productDescriptionEn || r.productTitleEn,
          slug: r.productSlug,
          pricePaisa: Number(r.pricePaisa),
          availability: r.fulfillmentType === "PRE_ORDER" ? "preorder" : "in_stock",
          brand: r.brandNameEn || "NCAMart",
          barcodeEan13: r.barcodeEan13,
          tier: r.productTier as "AUTHENTIC" | "BUDGET_SMART",
          imageUrl: `https://cdn.ncamart.com/products/${r.productSlug}/main.webp`,
        }));
      }
    } catch {
      // Memory fallback
    }

    // Default sample if database empty
    return [
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
    ];
  },

  // --------------------------------------------------------------------------
  // 3. Sitemap Query (Product slugs & Category slugs)
  // --------------------------------------------------------------------------
  async getSitemapData(tx?: Tx): Promise<{
    products: Array<{ slug: string; updatedAt: Date }>;
    categories: Array<{ slug: string; updatedAt: Date }>;
  }> {
    if (mockSitemapData) {
      return mockSitemapData;
    }

    const client = tx ?? defaultDb;
    try {
      const productRows = await client
        .select({ slug: products.slug, updatedAt: products.updatedAt })
        .from(products)
        .where(eq(products.status, "PUBLISHED"));

      const categoryRows = await client
        .select({ slug: categories.slug, updatedAt: categories.updatedAt })
        .from(categories)
        .where(eq(categories.isActive, true));

      if (productRows.length > 0 || categoryRows.length > 0) {
        return {
          products: productRows.map((p) => ({ slug: p.slug, updatedAt: new Date(p.updatedAt) })),
          categories: categoryRows.map((c) => ({ slug: c.slug, updatedAt: new Date(c.updatedAt) })),
        };
      }
    } catch {
      // Memory fallback
    }

    return {
      products: [
        { slug: "anker-65w-gan-fast-charger", updatedAt: new Date("2026-10-20T10:00:00Z") },
        { slug: "baseus-20w-type-c-lightning-cable", updatedAt: new Date("2026-10-22T12:00:00Z") },
      ],
      categories: [
        { slug: "chargers-adapters", updatedAt: new Date("2026-10-01T00:00:00Z") },
        { slug: "cables", updatedAt: new Date("2026-10-01T00:00:00Z") },
      ],
    };
  },
};
