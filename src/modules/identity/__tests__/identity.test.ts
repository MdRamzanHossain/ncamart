import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { geoService } from "../service";
import { GET as getDivisionsRoute } from "@/app/api/v1/geo/divisions/route";
import { GET as getDistrictsRoute } from "@/app/api/v1/geo/districts/route";
import { GET as getThanasRoute } from "@/app/api/v1/geo/thanas/route";
import { normalizeBdPhone, isValidBdPhone } from "@/lib/phone";

describe("identity module & Bangladesh geo data unit tests", () => {
  describe("geoService", () => {
    it("returns all 8 divisions with both English and Bangla names", async () => {
      const divisions = await geoService.getDivisions();
      expect(divisions).toHaveLength(8);

      const dhakaDiv = divisions.find((d) => d.nameEn === "Dhaka");
      expect(dhakaDiv).toBeDefined();
      expect(dhakaDiv?.nameBn).toBe("ঢাকা");

      const chittagongDiv = divisions.find((d) => d.nameEn === "Chattogram");
      expect(chittagongDiv).toBeDefined();
      expect(chittagongDiv?.nameBn).toBe("চট্টগ্রাম");
    });

    it("filters 64 districts by division_id correctly", async () => {
      const allDistricts = await geoService.getDistricts();
      expect(allDistricts.length).toBe(64);

      // Division 1 is Dhaka
      const dhakaDistricts = await geoService.getDistricts("1");
      expect(dhakaDistricts.length).toBeGreaterThan(0);
      expect(dhakaDistricts.every((d) => d.divisionId === "1")).toBe(true);
      expect(dhakaDistricts.some((d) => d.nameEn === "Gazipur")).toBe(true);

      // Division 6 is Sylhet
      const sylhetDistricts = await geoService.getDistricts("6");
      expect(sylhetDistricts.some((d) => d.nameEn === "Sylhet")).toBe(true);
    });

    it("verifies Dhaka metro thanas are tagged with isInsideDhaka = true", async () => {
      const dhakaThanas = await geoService.getThanas("1");
      expect(dhakaThanas.length).toBeGreaterThan(0);

      const nawabpur = dhakaThanas.find((t) => t.nameEn.includes("Nawabpur") || t.nameEn.includes("Kotwali"));
      expect(nawabpur).toBeDefined();
      expect(nawabpur?.isInsideDhaka).toBe(true);
      expect(nawabpur?.nameBn).toBe("কোতোয়ালী (নবাবপুর)");

      const dhanmondi = dhakaThanas.find((t) => t.nameEn === "Dhanmondi");
      expect(dhanmondi?.isInsideDhaka).toBe(true);
    });
  });

  describe("geo API routes", () => {
    it("serves GET /api/v1/geo/divisions with 24h cache-control header", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/geo/divisions");
      const res = await getDivisionsRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toContain("max-age=86400");

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(8);
      expect(data[0].nameEn).toBeDefined();
      expect(data[0].nameBn).toBeDefined();
    });

    it("serves GET /api/v1/geo/districts?division_id=1", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/geo/districts?division_id=1");
      const res = await getDistrictsRoute(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.every((d: { divisionId: string }) => d.divisionId === "1")).toBe(true);
    });

    it("serves GET /api/v1/geo/thanas?district_id=1", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/geo/thanas?district_id=1");
      const res = await getThanasRoute(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe("customer phone and address invariants", () => {
    it("enforces normalized Bangladeshi MSISDN format (+8801XXXXXXXXX)", () => {
      const valid1 = "01712345678";
      expect(isValidBdPhone(valid1)).toBe(true);
      expect(normalizeBdPhone(valid1)).toBe("+8801712345678");

      const invalidPhone = "01212345678"; // 012 is not a valid operator prefix
      expect(isValidBdPhone(invalidPhone)).toBe(false);
      expect(() => normalizeBdPhone(invalidPhone)).toThrow();
    });
  });
});
