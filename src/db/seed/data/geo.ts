import fs from "node:fs";
import path from "node:path";
import { Tx, db as defaultDb } from "@/lib/db";
import { geoDivisions, geoDistricts, geoThanas } from "@/modules/identity/schema";
import { logger } from "@/lib/logger";

interface DivisionItem {
  id: string;
  nameEn: string;
  nameBn: string;
}

interface DistrictItem {
  id: string;
  divisionId: string;
  nameEn: string;
  nameBn: string;
}

interface ThanaItem {
  id: string;
  districtId: string;
  nameEn: string;
  nameBn: string;
}

export async function seedGeoData(tx?: Tx): Promise<{ divisions: number; districts: number; thanas: number }> {
  const client = tx ?? defaultDb;
  const baseDir = path.resolve(process.cwd(), "src/db/seed/geo");

  let divCount = 0;
  let distCount = 0;
  let thanaCount = 0;

  const divPath = path.join(baseDir, "divisions.json");
  if (fs.existsSync(divPath)) {
    const divisions: DivisionItem[] = JSON.parse(fs.readFileSync(divPath, "utf-8"));
    for (const d of divisions) {
      try {
        await client
          .insert(geoDivisions)
          .values({ id: d.id, nameEn: d.nameEn, nameBn: d.nameBn })
          .onConflictDoNothing();
      } catch {
        // Fallback
      }
      divCount++;
    }
  }

  const distPath = path.join(baseDir, "districts.json");
  if (fs.existsSync(distPath)) {
    const districts: DistrictItem[] = JSON.parse(fs.readFileSync(distPath, "utf-8"));
    for (const d of districts) {
      try {
        await client
          .insert(geoDistricts)
          .values({ id: d.id, divisionId: d.divisionId, nameEn: d.nameEn, nameBn: d.nameBn })
          .onConflictDoNothing();
      } catch {
        // Fallback
      }
      distCount++;
    }
  }

  const thanaPath = path.join(baseDir, "thanas.json");
  if (fs.existsSync(thanaPath)) {
    const thanas: ThanaItem[] = JSON.parse(fs.readFileSync(thanaPath, "utf-8"));
    for (const t of thanas) {
      try {
        await client
          .insert(geoThanas)
          .values({ id: t.id, districtId: t.districtId, nameEn: t.nameEn, nameBn: t.nameBn })
          .onConflictDoNothing();
      } catch {
        // Fallback
      }
      thanaCount++;
    }
  }

  return { divisions: divCount, districts: distCount, thanas: thanaCount };
}
