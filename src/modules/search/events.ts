import { registerEventHandler } from "@/lib/outbox";
import { logger } from "@/lib/logger";
import { searchService } from "./service";
import { OutboxRow } from "@/db/infra";

/**
 * Handles product publication event by indexing the document.
 */
export async function handleProductPublished(event: OutboxRow): Promise<void> {
  const payload = event.payload as { productId?: string };
  const productId = payload.productId ?? event.aggregateId;
  if (!productId) {
    logger.warn({ eventId: event.id }, "No productId in product_published event");
    return;
  }
  await searchService.indexProduct(productId);
}

/**
 * Handles product updated event by updating or removing the document.
 */
export async function handleProductUpdated(event: OutboxRow): Promise<void> {
  const payload = event.payload as { productId?: string };
  const productId = payload.productId ?? event.aggregateId;
  if (!productId) return;
  await searchService.indexProduct(productId);
}

/**
 * Handles product archived event by deleting it from search index.
 */
export async function handleProductArchived(event: OutboxRow): Promise<void> {
  const payload = event.payload as { productId?: string };
  const productId = payload.productId ?? event.aggregateId;
  if (!productId) return;
  await searchService.deleteProduct(productId);
}

/**
 * Handles inventory availability changes by refreshing the product document.
 */
export async function handleInventoryAvailabilityChanged(event: OutboxRow): Promise<void> {
  const payload = event.payload as { productId?: string; skuId?: string };
  const productId = payload.productId ?? event.aggregateId;
  if (productId) {
    await searchService.indexProduct(productId);
  }
}

/**
 * Register all search outbox event listeners.
 */
export function registerSearchEventHandlers(): void {
  registerEventHandler("catalog.product_published", handleProductPublished);
  registerEventHandler("catalog.product_updated", handleProductUpdated);
  registerEventHandler("catalog.product_archived", handleProductArchived);
  registerEventHandler("inventory.availability_changed", handleInventoryAvailabilityChanged);
}

// Auto-register on module load
registerSearchEventHandlers();
