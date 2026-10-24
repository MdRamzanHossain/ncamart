import { searchService } from "./service";
import { logger } from "@/lib/logger";

async function run(): Promise<void> {
  try {
    logger.info("Executing search:reindex CLI task...");
    const result = await searchService.reindexAll();
    logger.info(
      { indexedCount: result.indexedCount, targetIndex: result.targetIndex },
      "search:reindex completed successfully"
    );
    process.exit(0);
  } catch (err) {
    logger.fatal({ err }, "search:reindex failed");
    process.exit(1);
  }
}

void run();
