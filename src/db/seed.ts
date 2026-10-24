import { logger } from "@/lib/logger";

export async function runSeeds() {
  logger.info("Database seeding started...");
  // TODO(P41): Comprehensive fixtures and seeds
  logger.info("Database seeding completed.");
}

if (process.argv[1]?.includes("seed.ts")) {
  runSeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, "Seeding failed");
      process.exit(1);
    });
}
