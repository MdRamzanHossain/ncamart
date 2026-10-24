import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  geoDivisions,
  geoDistricts,
  geoThanas,
  geoAreas,
} from "./schema";
import {
  GeoDivisionDto,
  GeoDistrictDto,
  GeoThanaDto,
  GeoAreaDto,
} from "./dto";
import fs from "node:fs";
import path from "node:path";

export const identityService = {
  healthCheck: async () => ({ module: "identity", status: "ok" }),
};

const GEO_CACHE_TTL_SECONDS = 86400; // 24 hours

// In-memory cache for geo queries
const memGeoCache = new Map<string, { data: unknown; expiresAt: number }>();

function readJsonSeedFile<T>(filename: string): T[] {
  try {
    const filePath = path.resolve(process.cwd(), "src/db/seed/geo", filename);
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T[];
  } catch (err) {
    logger.warn({ err, filename }, "Failed to read geo JSON seed file");
    return [];
  }
}

export const geoService = {
  /**
   * Get all 8 administrative divisions of Bangladesh.
   */
  async getDivisions(): Promise<GeoDivisionDto[]> {
    const cacheKey = "geo:divisions";
    const now = Date.now();

    const memCached = memGeoCache.get(cacheKey);
    if (memCached && memCached.expiresAt > now) {
      return memCached.data as GeoDivisionDto[];
    }

    if (!env.MOCK_EXTERNAL_SERVICES) {
      try {
        const redis = getRedis();
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as GeoDivisionDto[];
          memGeoCache.set(cacheKey, { data: parsed, expiresAt: now + GEO_CACHE_TTL_SECONDS * 1000 });
          return parsed;
        }
      } catch {
        // Fallback to DB/file
      }
    }

    let results: GeoDivisionDto[] = [];
    try {
      const rows = await db.select().from(geoDivisions);
      if (rows.length > 0) {
        results = rows.map((r) => ({
          id: r.id,
          nameEn: r.nameEn,
          nameBn: r.nameBn,
        }));
      }
    } catch {
      // Ignored if DB is offline
    }

    if (results.length === 0) {
      results = readJsonSeedFile<GeoDivisionDto>("divisions.json");
    }

    memGeoCache.set(cacheKey, { data: results, expiresAt: now + GEO_CACHE_TTL_SECONDS * 1000 });
    return results;
  },

  /**
   * Get Bangladesh districts, optionally filtered by division ID.
   */
  async getDistricts(divisionId?: string): Promise<GeoDistrictDto[]> {
    const cacheKey = `geo:districts:${divisionId || "all"}`;
    const now = Date.now();

    const memCached = memGeoCache.get(cacheKey);
    if (memCached && memCached.expiresAt > now) {
      return memCached.data as GeoDistrictDto[];
    }

    let results: GeoDistrictDto[] = [];
    try {
      const query = divisionId
        ? db.select().from(geoDistricts).where(eq(geoDistricts.divisionId, divisionId))
        : db.select().from(geoDistricts);
      const rows = await query;
      if (rows.length > 0) {
        results = rows.map((r) => ({
          id: r.id,
          divisionId: r.divisionId,
          nameEn: r.nameEn,
          nameBn: r.nameBn,
        }));
      }
    } catch {
      // Ignored if DB is offline
    }

    if (results.length === 0) {
      const allDistricts = readJsonSeedFile<GeoDistrictDto>("districts.json");
      results = divisionId
        ? allDistricts.filter((d) => d.divisionId === divisionId)
        : allDistricts;
    }

    memGeoCache.set(cacheKey, { data: results, expiresAt: now + GEO_CACHE_TTL_SECONDS * 1000 });
    return results;
  },

  /**
   * Get thanas/upazilas, optionally filtered by district ID.
   */
  async getThanas(districtId?: string): Promise<GeoThanaDto[]> {
    const cacheKey = `geo:thanas:${districtId || "all"}`;
    const now = Date.now();

    const memCached = memGeoCache.get(cacheKey);
    if (memCached && memCached.expiresAt > now) {
      return memCached.data as GeoThanaDto[];
    }

    let results: GeoThanaDto[] = [];
    try {
      const query = districtId
        ? db.select().from(geoThanas).where(eq(geoThanas.districtId, districtId))
        : db.select().from(geoThanas);
      const rows = await query;
      if (rows.length > 0) {
        results = rows.map((r) => ({
          id: r.id,
          districtId: r.districtId,
          nameEn: r.nameEn,
          nameBn: r.nameBn,
          isInsideDhaka: r.isInsideDhaka,
        }));
      }
    } catch {
      // Ignored if DB is offline
    }

    if (results.length === 0) {
      const allThanas = readJsonSeedFile<GeoThanaDto>("thanas.json");
      results = districtId
        ? allThanas.filter((t) => t.districtId === districtId)
        : allThanas;
    }

    memGeoCache.set(cacheKey, { data: results, expiresAt: now + GEO_CACHE_TTL_SECONDS * 1000 });
    return results;
  },

  /**
   * Get areas/sub-localities, optionally filtered by thana ID.
   */
  async getAreas(thanaId?: string): Promise<GeoAreaDto[]> {
    const cacheKey = `geo:areas:${thanaId || "all"}`;
    const now = Date.now();

    const memCached = memGeoCache.get(cacheKey);
    if (memCached && memCached.expiresAt > now) {
      return memCached.data as GeoAreaDto[];
    }

    let results: GeoAreaDto[] = [];
    try {
      const query = thanaId
        ? db.select().from(geoAreas).where(eq(geoAreas.thanaId, thanaId))
        : db.select().from(geoAreas);
      const rows = await query;
      results = rows.map((r) => ({
        id: r.id,
        thanaId: r.thanaId,
        nameEn: r.nameEn,
        nameBn: r.nameBn,
        postalCode: r.postalCode,
      }));
    } catch {
      // Ignored if DB offline
    }

    memGeoCache.set(cacheKey, { data: results, expiresAt: now + GEO_CACHE_TTL_SECONDS * 1000 });
    return results;
  },

  clearMemoryCacheForTesting(): void {
    memGeoCache.clear();
  },
};
