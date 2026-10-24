import { Meilisearch, Index } from "meilisearch";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { SEARCH_SYNONYMS } from "./synonyms";

export const PRODUCTS_INDEX = "products";

export const PRODUCT_INDEX_SETTINGS = {
  searchableAttributes: [
    "title_en",
    "title_bn",
    "brand",
    "spec_keywords",
    "sku_codes",
    "category_path_en",
    "category_path_bn",
    "slug",
  ],
  filterableAttributes: [
    "tier",
    "category_ids",
    "brand",
    "fulfillment_type",
    "availability",
    "min_price_paisa",
  ],
  sortableAttributes: ["min_price_paisa", "published_at"],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 4,
      twoTypos: 8,
    },
    disableOnWords: [],
    disableOnAttributes: [],
  },
  synonyms: SEARCH_SYNONYMS,
};

let meiliClientInstance: Meilisearch | null = null;

export function getMeiliClient(): Meilisearch {
  if (!meiliClientInstance) {
    meiliClientInstance = new Meilisearch({
      host: env.MEILI_HOST,
      apiKey: env.MEILI_MASTER_KEY,
      timeout: 3000,
    });
  }
  return meiliClientInstance;
}

export function setMeiliClientForTest(client: Meilisearch | null): void {
  meiliClientInstance = client;
}

/**
 * Checks if Meilisearch service is reachable and healthy.
 */
export async function isMeiliAvailable(): Promise<boolean> {
  if (meiliClientInstance) {
    try {
      const health = await meiliClientInstance.isHealthy();
      return Boolean(health);
    } catch {
      return false;
    }
  }
  if (env.MOCK_EXTERNAL_SERVICES) {
    return false;
  }
  try {
    const client = getMeiliClient();
    const health = await client.isHealthy();
    return Boolean(health);
  } catch (err) {
    logger.debug({ err }, "Meilisearch health check failed");
    return false;
  }
}

/**
 * Configure settings on a Meilisearch index (or ensure it exists).
 */
export async function setupIndexSettings(indexName: string = PRODUCTS_INDEX): Promise<Index> {
  const client = getMeiliClient();
  let index: Index;
  try {
    index = client.index(indexName);
    await index.getRawInfo();
  } catch {
    const task = await client.createIndex(indexName, { primaryKey: "id" });
    if (client.tasks?.waitForTask) {
      await client.tasks.waitForTask(task.taskUid);
    } else if (typeof (client as unknown as { waitForTask?: (uid: number) => Promise<unknown> }).waitForTask === "function") {
      await (client as unknown as { waitForTask: (uid: number) => Promise<unknown> }).waitForTask(task.taskUid);
    }
    index = client.index(indexName);
  }

  const updateTask = await index.updateSettings(PRODUCT_INDEX_SETTINGS);
  if (client.tasks?.waitForTask) {
    await client.tasks.waitForTask(updateTask.taskUid);
  } else if (typeof (client as unknown as { waitForTask?: (uid: number) => Promise<unknown> }).waitForTask === "function") {
    await (client as unknown as { waitForTask: (uid: number) => Promise<unknown> }).waitForTask(updateTask.taskUid);
  }

  return index;
}
