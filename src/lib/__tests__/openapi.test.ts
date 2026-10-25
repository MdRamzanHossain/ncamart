import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { generateOpenApiSpec } from "../openapi/registry";
import { generateOpenApiFiles } from "../openapi";
import { checkOpenApiCoverage } from "../openapi/check";
import { GET as getOpenApiJson } from "@/app/api/v1/openapi.json/route";
import { GET as getDocs } from "@/app/api/docs/route";
import { staffAuthService } from "@/modules/identity";

describe("P42 — OpenAPI Spec & API Documentation", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppEnv = process.env.APP_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.APP_ENV = originalAppEnv;
  });

  describe("1. OpenAPI 3.1 Generation & Validation", () => {
    it("generates a valid OpenAPI 3.1.0 document from registered Zod schemas", () => {
      const { document, scannedRoutes } = generateOpenApiSpec();

      expect(document.openapi).toBe("3.1.0");
      expect(document.info.title).toContain("NCAMart");
      expect(document.info.version).toBe("2.0.0");
      expect(document.paths).toBeDefined();

      const pathCount = Object.keys(document.paths).length;
      expect(pathCount).toBeGreaterThan(200);
      expect(scannedRoutes.length).toBeGreaterThanOrEqual(250);

      // Verify core security schemes
      expect(document.components?.securitySchemes).toHaveProperty("cookieAuth");
      expect(document.components?.securitySchemes).toHaveProperty("bearerAuth");
      expect(document.components?.securitySchemes).toHaveProperty("internalSecret");

      // Verify core component schemas
      expect(document.components?.schemas).toHaveProperty("ErrorEnvelope");
      expect(document.components?.schemas).toHaveProperty("GenericSuccess");
    }, 30000);

    it("pnpm openapi:generate writes docs/openapi.json and docs/API.md", async () => {
      const result = await generateOpenApiFiles();

      expect(fs.existsSync(result.openApiPath)).toBe(true);
      expect(fs.existsSync(result.markdownPath)).toBe(true);

      const jsonContent = JSON.parse(fs.readFileSync(result.openApiPath, "utf8"));
      expect(jsonContent.openapi).toBe("3.1.0");

      const mdContent = fs.readFileSync(result.markdownPath, "utf8");
      expect(mdContent).toContain("# NCAMart REST API Specification");
      expect(mdContent).toContain("Total Active Endpoints:");
      expect(mdContent).toContain("## 2. Active Endpoints Directory");
      expect(mdContent).toContain("## 3. Intentional Architectural Deviations Against `api-spec.md`");
      expect(mdContent).toContain("Pre-Order Balance COD Cap");
      expect(mdContent).toContain("Public `/verify` Clone Alerts");
      expect(mdContent).toContain("Showroom Walk-in Sale Lifecycle");
      expect(mdContent).toContain("DECISIONS.md");
    }, 30000);
  });

  describe("2. CI Route Coverage Completeness Check", () => {
    it("verifies 100% of route handlers across src/app are registered in OpenAPI", () => {
      const { totalScanned, totalRegistered, missing } = checkOpenApiCoverage();

      expect(missing).toEqual([]);
      expect(totalRegistered).toBe(totalScanned);
      expect(totalScanned).toBeGreaterThanOrEqual(260);
    }, 30000);
  });

  describe("3. GET /api/v1/openapi.json", () => {
    it("serves valid OpenAPI 3.1 JSON with correct headers", async () => {
      const res = await getOpenApiJson();

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");
      expect(res.headers.get("Cache-Control")).toContain("public");

      const data = await res.json();
      expect(data.openapi).toBe("3.1.0");
      expect(data.paths).toBeDefined();
    });
  });

  describe("4. GET /api/docs Documentation Viewer & Environment Guard", () => {
    it("serves Scalar UI documentation in dev/test/staging environments without authentication", async () => {
      process.env.NODE_ENV = "development";
      process.env.APP_ENV = "staging";

      const req = new NextRequest("http://localhost:3000/api/docs");
      const res = await getDocs(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("@scalar/api-reference");
      expect(html).toContain("data-url=\"/api/v1/openapi.json\"");
    });

    it("blocks unauthenticated requests in production environment with 403", async () => {
      process.env.NODE_ENV = "production";
      process.env.APP_ENV = "production";

      const req = new NextRequest("https://ncamart.com/api/docs");
      const res = await getDocs(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("ERR_FORBIDDEN");
      expect(data.error.message).toContain("SUPER_ADMIN");
    });

    it("allows SUPER_ADMIN staff session in production environment", async () => {
      process.env.NODE_ENV = "production";
      process.env.APP_ENV = "production";

      // Create memory staff session with SUPER_ADMIN
      const adminStaffId = "staff-super-admin-001";
      const token = "admin-secret-test-token-777";
      staffAuthService.setMemoryStaff(adminStaffId, ["SUPER_ADMIN"]);
      staffAuthService.setMemoryStaffSession(token, adminStaffId);

      const req = new NextRequest("https://ncamart.com/api/docs", {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const res = await getDocs(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain("@scalar/api-reference");
    });
  });
});
