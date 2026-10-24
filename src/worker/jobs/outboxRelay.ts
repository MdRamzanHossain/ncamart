import { drainOutbox } from "@/lib/outbox";
import { logger } from "@/lib/logger";

export async function processOutboxBatch(): Promise<number> {
  try {
    const publishedCount = await drainOutbox();
    if (publishedCount > 0) {
      logger.info({ publishedCount }, "Successfully relayed outbox events batch");
    }
    return publishedCount;
  } catch (err) {
    logger.error({ err }, "Error in outbox relay processor");
    throw err;
  }
}
