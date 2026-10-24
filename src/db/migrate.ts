import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";
import { logger } from "@/lib/logger";
import { settingsService } from "@/modules/settings/service";
import fs from "node:fs/promises";
import path from "node:path";

export async function runMigrations() {
  logger.info("Running database migrations...");
  try {
    const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
    await migrate(db, { migrationsFolder });
    logger.info("Drizzle migrations applied successfully.");

    // Run custom SQL triggers and functions
    const sqlDir = path.resolve(process.cwd(), "src/db/sql");
    try {
      const sqlFiles = (await fs.readdir(sqlDir)).filter((f) => f.endsWith(".sql")).sort();
      for (const file of sqlFiles) {
        const filePath = path.join(sqlDir, file);
        const sqlContent = await fs.readFile(filePath, "utf-8");
        logger.info({ file }, "Applying custom SQL script");
        await pool.query(sqlContent);
      }
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code !== "ENOENT") {
        throw err;
      }
    }

    // Seed default settings
    await settingsService.seedDefaults();
    logger.info("Default settings verified/seeded.");
  } catch (err) {
    logger.error({ err }, "Migration execution failed");
    throw err;
  }
}

if (process.argv[1]?.includes("migrate.ts")) {
  runMigrations()
    .then(() => {
      logger.info("Migration completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "Migration failed");
      process.exit(1);
    });
}
