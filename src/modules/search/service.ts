import { logger } from "@/lib/logger";
import { catalogService } from "@/modules/catalog";
import {
  SearchQueryParams,
  SearchResult,
  ProductSearchDocument,
  SearchFacetDistribution,
} from "./dto";
import {
  getMeiliClient,
  isMeiliAvailable,
  setupIndexSettings,
  PRODUCTS_INDEX,
} from "./client";
import {
  buildProductSearchDocument,
  searchRepo,
} from "./repo";
import { normalizeSearchQuery, SEARCH_SYNONYMS } from "./synonyms";

/**
 * Calculates Damerau-Levenshtein distance between two strings with adjacent transposition support.
 */
function damerauLevenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const d: number[][] = Array.from({ length: an + 1 }, () =>
    new Array<number>(bn + 1).fill(0)
  );
  for (let i = 0; i <= an; i++) {
    const row = d[i];
    if (row) row[0] = i;
  }
  const firstRow = d[0];
  if (firstRow) {
    for (let j = 0; j <= bn; j++) {
      firstRow[j] = j;
    }
  }

  for (let i = 1; i <= an; i++) {
    const currentRow = d[i];
    const prevRow = d[i - 1];
    const prev2Row = i > 1 ? d[i - 2] : undefined;
    if (!currentRow || !prevRow) continue;

    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const del = (prevRow[j] ?? 0) + 1;
      const ins = (currentRow[j - 1] ?? 0) + 1;
      const sub = (prevRow[j - 1] ?? 0) + cost;
      let minVal = Math.min(del, ins, sub);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && prev2Row) {
        minVal = Math.min(minVal, (prev2Row[j - 2] ?? 0) + 1);
      }
      currentRow[j] = minVal;
    }
  }
  return d[an]?.[bn] ?? 0;
}

/**
 * Checks if candidate word matches query word directly, via synonyms, or with 1-2 typos.
 */
function isWordMatch(candidate: string, queryWord: string, synonyms: string[]): boolean {
  const c = candidate.toLowerCase();
  const q = queryWord.toLowerCase();
  if (c === q || c.includes(q) || q.includes(c)) return true;

  for (const syn of synonyms) {
    const s = syn.toLowerCase();
    if (c === s || c.includes(s) || s.includes(c)) return true;
  }

  // Typo tolerance: if query word >= 4 chars, allow 1 typo; if >= 8 chars, allow 2
  if (q.length >= 4) {
    const maxDistance = q.length >= 8 ? 2 : 1;
    if (damerauLevenshtein(c, q) <= maxDistance) return true;
    for (const syn of synonyms) {
      if (damerauLevenshtein(c, syn.toLowerCase()) <= maxDistance) return true;
    }
  }

  return false;
}

/**
 * Highlights matches in text using <em>...</em>
 */
function highlightText(text: string, terms: string[]): string {
  if (!text || terms.length === 0) return text;
  let highlighted = text;
  for (const term of terms) {
    if (!term) continue;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    highlighted = highlighted.replace(regex, "<em>$1</em>");
  }
  return highlighted;
}

export const searchService = {
  /**
   * Clears memory document store for tests.
   */
  clearMemorySearchForTesting(): void {
    searchRepo.clearDocuments();
  },

  /**
   * Retrieves an in-memory search document for assertions in tests.
   */
  getMemoryDocumentForTesting(productId: string): ProductSearchDocument | null {
    return searchRepo.getDocument(productId);
  },

  /**
   * Health check for search module.
   */
  async healthCheck(): Promise<{ module: string; status: string; meiliAvailable: boolean }> {
    const meiliAvailable = await isMeiliAvailable();
    return {
      module: "search",
      status: "ok",
      meiliAvailable,
    };
  },

  /**
   * Index or update a single product document in Meilisearch and memory fallback.
   */
  async indexProduct(productId: string): Promise<void> {
    const doc = await buildProductSearchDocument(productId);
    if (!doc) {
      // If product is no longer published or has no active SKUs, remove it
      await this.deleteProduct(productId);
      return;
    }

    searchRepo.saveDocument(doc);

    if (await isMeiliAvailable()) {
      try {
        const index = await setupIndexSettings(PRODUCTS_INDEX);
        await index.addDocuments([doc], { primaryKey: "id" });
      } catch (err) {
        logger.warn({ err, productId }, "Failed to upsert product into Meilisearch index");
      }
    }
  },

  /**
   * Remove a product document from Meilisearch and memory fallback.
   */
  async deleteProduct(productId: string): Promise<void> {
    searchRepo.deleteDocument(productId);

    if (await isMeiliAvailable()) {
      try {
        const client = getMeiliClient();
        const index = client.index(PRODUCTS_INDEX);
        await index.deleteDocument(productId);
      } catch (err) {
        logger.warn({ err, productId }, "Failed to delete product from Meilisearch index");
      }
    }
  },

  /**
   * Full rebuild from Postgres / Catalog into a new temporary index, then atomic swap.
   * CLI: pnpm search:reindex
   */
  async reindexAll(): Promise<{ indexedCount: number; targetIndex: string }> {
    logger.info("Starting full search index rebuild...");

    const publishedProducts = await catalogService.listPublishedProducts();
    const documents: ProductSearchDocument[] = [];

    searchRepo.clearDocuments();

    for (const prod of publishedProducts) {
      const doc = await buildProductSearchDocument(prod.id);
      if (doc) {
        documents.push(doc);
        searchRepo.saveDocument(doc);
      }
    }

    logger.info(
      { publishedCount: publishedProducts.length, indexedDocuments: documents.length },
      "Prepared search documents for indexing"
    );

    const meiliOk = await isMeiliAvailable();
    if (!meiliOk) {
      logger.warn(
        "Meilisearch is not available or mock mode is active. In-memory search store updated."
      );
      return {
        indexedCount: documents.length,
        targetIndex: "in-memory",
      };
    }

    const client = getMeiliClient();
    const tempIndexName = `${PRODUCTS_INDEX}_temp_${Date.now()}`;

    try {
      // 1. Configure settings on the temporary index
      const tempIndex = await setupIndexSettings(tempIndexName);

      // 2. Add documents in batch
      if (documents.length > 0) {
        const addBatchTask = await tempIndex.addDocuments(documents, { primaryKey: "id" });
        if (client.tasks?.waitForTask) {
          await client.tasks.waitForTask(addBatchTask.taskUid);
        } else if (typeof (client as unknown as { waitForTask?: (uid: number) => Promise<unknown> }).waitForTask === "function") {
          await (client as unknown as { waitForTask: (uid: number) => Promise<unknown> }).waitForTask(addBatchTask.taskUid);
        }
      }

      // 3. Ensure target index exists
      await setupIndexSettings(PRODUCTS_INDEX);

      // 4. Perform atomic swap
      const swapTask = await client.swapIndexes([
        { indexes: [PRODUCTS_INDEX, tempIndexName], rename: false },
      ]);
      if (client.tasks?.waitForTask) {
        await client.tasks.waitForTask(swapTask.taskUid);
      } else if (typeof (client as unknown as { waitForTask?: (uid: number) => Promise<unknown> }).waitForTask === "function") {
        await (client as unknown as { waitForTask: (uid: number) => Promise<unknown> }).waitForTask(swapTask.taskUid);
      }

      // 5. Clean up old temporary index
      try {
        await client.deleteIndex(tempIndexName);
      } catch {
        // Ignored
      }

      logger.info(
        { indexedCount: documents.length, index: PRODUCTS_INDEX },
        "Search reindex and atomic swap completed successfully"
      );

      return {
        indexedCount: documents.length,
        targetIndex: PRODUCTS_INDEX,
      };
    } catch (err) {
      logger.error({ err }, "Error during search reindex and atomic swap");
      throw err;
    }
  },

  /**
   * Search catalog products with filters, highlights, and facets.
   * Gracefully falls back to ILIKE query if Meilisearch is unreachable.
   */
  async search(params: SearchQueryParams): Promise<SearchResult> {
    const rawQuery = params.q?.trim() ?? "";
    const normalizedQuery = normalizeSearchQuery(rawQuery);

    if (await isMeiliAvailable()) {
      try {
        return await this.searchMeilisearch(params, normalizedQuery);
      } catch (err) {
        logger.warn({ err }, "Meilisearch query failed, falling back to ILIKE search");
      }
    }

    return this.searchIlikeFallback(params, normalizedQuery);
  },

  /**
   * Execute search directly against Meilisearch.
   */
  async searchMeilisearch(
    params: SearchQueryParams,
    normalizedQuery: string
  ): Promise<SearchResult> {
    const client = getMeiliClient();
    const index = client.index(PRODUCTS_INDEX);

    const filterExpressions: string[] = [];

    if (params.tier) {
      filterExpressions.push(`tier = '${params.tier}'`);
    }
    if (params.category) {
      // Matches if category ID or ancestor ID is present in category_ids
      filterExpressions.push(`category_ids = '${params.category}'`);
    }
    if (params.brand) {
      filterExpressions.push(`brand = '${params.brand}'`);
    }
    if (params.fulfillment) {
      filterExpressions.push(`fulfillment_type = '${params.fulfillment}'`);
    }
    if (params.availability && params.availability !== "ANY") {
      filterExpressions.push(`availability = '${params.availability}'`);
    }
    if (params.min_price !== undefined) {
      filterExpressions.push(`min_price_paisa >= ${params.min_price}`);
    }
    if (params.max_price !== undefined) {
      filterExpressions.push(`min_price_paisa <= ${params.max_price}`);
    }

    const sortOptions: string[] = [];
    if (params.sort === "PRICE_ASC") {
      sortOptions.push("min_price_paisa:asc");
    } else if (params.sort === "PRICE_DESC") {
      sortOptions.push("min_price_paisa:desc");
    } else if (params.sort === "NEWEST") {
      sortOptions.push("published_at:desc");
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const searchResponse = await index.search(normalizedQuery, {
      filter: filterExpressions.length > 0 ? filterExpressions.join(" AND ") : undefined,
      sort: sortOptions.length > 0 ? sortOptions : undefined,
      offset,
      limit,
      facets: ["tier", "brand", "category_path_en"],
      attributesToHighlight: [
        "title_en",
        "title_bn",
        "brand",
        "spec_keywords",
        "category_path_en",
        "category_path_bn",
      ],
      highlightPreTag: "<em>",
      highlightPostTag: "</em>",
    });

    const rawResponse = searchResponse as unknown as {
      estimatedTotalHits?: number;
      totalHits?: number;
      hits: unknown[];
    };
    const totalHits =
      rawResponse.estimatedTotalHits ??
      rawResponse.totalHits ??
      rawResponse.hits.length;

    const facetDist = searchResponse.facetDistribution ?? {};
    const facets: SearchFacetDistribution = {
      tier: (facetDist.tier as Record<string, number>) ?? {},
      brand: (facetDist.brand as Record<string, number>) ?? {},
      category: (facetDist.category_path_en as Record<string, number>) ?? {},
    };

    return {
      hits: searchResponse.hits as Array<
        ProductSearchDocument & { _formatted?: Partial<ProductSearchDocument> }
      >,
      facets,
      pagination: {
        total: totalHits,
        page,
        limit,
        total_pages: Math.ceil(totalHits / limit) || 0,
      },
    };
  },

  /**
   * Fallback PostgreSQL / memory ILIKE search when Meilisearch is down or offline.
   */
  async searchIlikeFallback(
    params: SearchQueryParams,
    normalizedQuery: string
  ): Promise<SearchResult> {
    logger.warn("Performing search via ILIKE fallback");

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    // Ensure documents are loaded
    const docs = searchRepo.getAllDocuments();
    if (docs.length === 0) {
      const published = await catalogService.listPublishedProducts();
      for (const prod of published) {
        const d = await buildProductSearchDocument(prod.id);
        if (d) {
          searchRepo.saveDocument(d);
          docs.push(d);
        }
      }
    }

    // Expand search query terms and synonyms
    const queryWords = normalizedQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const expandedTerms = new Set<string>();
    for (const w of queryWords) {
      expandedTerms.add(w);
      const syns = SEARCH_SYNONYMS[w] ?? [];
      for (const s of syns) {
        expandedTerms.add(s.toLowerCase());
      }
      for (const [key, synList] of Object.entries(SEARCH_SYNONYMS)) {
        if (damerauLevenshtein(w, key) <= 1) {
          expandedTerms.add(key);
          for (const s of synList) {
            expandedTerms.add(s.toLowerCase());
          }
        }
      }
    }
    const termsArray = Array.from(expandedTerms);

    // Filter documents
    const matchingDocs = docs.filter((doc) => {
      // 1. Text match (if query provided)
      if (queryWords.length > 0) {
        const documentTextTokens = [
          doc.title_en,
          doc.title_bn,
          doc.brand,
          doc.category_path_en,
          doc.category_path_bn,
          ...doc.spec_keywords,
          ...doc.sku_codes,
        ]
          .join(" ")
          .toLowerCase()
          .split(/[\s,>]+/);

        // Check if all query words match at least one token in document
        const hasMatch = queryWords.every((qWord) => {
          return documentTextTokens.some((token) => isWordMatch(token, qWord, termsArray));
        });

        if (!hasMatch) return false;
      }

      // 2. Filters
      if (params.tier && doc.tier !== params.tier) {
        return false;
      }
      if (params.category && !doc.category_ids.includes(params.category)) {
        return false;
      }
      if (params.brand && doc.brand.toLowerCase() !== params.brand.toLowerCase()) {
        return false;
      }
      if (params.fulfillment && doc.fulfillment_type !== params.fulfillment) {
        return false;
      }
      if (params.availability && params.availability !== "ANY" && doc.availability !== params.availability) {
        return false;
      }
      if (params.min_price !== undefined && doc.min_price_paisa < params.min_price) {
        return false;
      }
      if (params.max_price !== undefined && doc.min_price_paisa > params.max_price) {
        return false;
      }

      return true;
    });

    // Compute facet distributions from all matched documents
    const tierFacets: Record<string, number> = {};
    const brandFacets: Record<string, number> = {};
    const categoryFacets: Record<string, number> = {};

    for (const d of matchingDocs) {
      tierFacets[d.tier] = (tierFacets[d.tier] ?? 0) + 1;
      if (d.brand) {
        brandFacets[d.brand] = (brandFacets[d.brand] ?? 0) + 1;
      }
      if (d.category_path_en) {
        categoryFacets[d.category_path_en] = (categoryFacets[d.category_path_en] ?? 0) + 1;
      }
    }

    // Sort
    if (params.sort === "PRICE_ASC") {
      matchingDocs.sort((a, b) => a.min_price_paisa - b.min_price_paisa);
    } else if (params.sort === "PRICE_DESC") {
      matchingDocs.sort((a, b) => b.min_price_paisa - a.min_price_paisa);
    } else if (params.sort === "NEWEST") {
      matchingDocs.sort((a, b) => b.published_at - a.published_at);
    }

    const total = matchingDocs.length;
    const startIndex = (page - 1) * limit;
    const pagedDocs = matchingDocs.slice(startIndex, startIndex + limit);

    // Highlight text for `_formatted`
    const hits = pagedDocs.map((doc) => {
      const formatted: Partial<ProductSearchDocument> = {
        title_en: highlightText(doc.title_en, termsArray),
        title_bn: highlightText(doc.title_bn, termsArray),
        brand: highlightText(doc.brand, termsArray),
        category_path_en: highlightText(doc.category_path_en, termsArray),
        category_path_bn: highlightText(doc.category_path_bn, termsArray),
      };
      return {
        ...doc,
        _formatted: formatted,
      };
    });

    return {
      hits,
      facets: {
        tier: tierFacets,
        brand: brandFacets,
        category: categoryFacets,
      },
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit) || 0,
      },
    };
  },
};
