import fs from "fs";
import path from "path";
import { HttpMethod, ScannedRoute, AuthRequirement } from "./types";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"];

export function getRouteFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getRouteFiles(fullPath, fileList);
    } else if (entry.isFile() && (entry.name === "route.ts" || entry.name === "route.js")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

export function scanAllRoutes(appDir = path.resolve(process.cwd(), "src/app")): ScannedRoute[] {
  const files = getRouteFiles(appDir);
  const scanned: ScannedRoute[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const relDir = path.relative(appDir, path.dirname(file)).replace(/\\/g, "/");
    const rawPath = "/" + relDir;
    // Next.js dynamic parameters: [slug] -> {slug}
    const openApiPath = rawPath.replace(/\[(\w+)\]/g, "{$1}");

    // Extract param names
    const paramMatches = [...openApiPath.matchAll(/\{(\w+)\}/g)];
    const paramNames = paramMatches.map((m) => m[1]);

    for (const method of METHODS) {
      const methodRegex = new RegExp(
        `export\\s+(const|async\\s+function|function)\\s+${method}\\b`
      );
      if (!methodRegex.test(content)) continue;

      // Extract route metadata
      let auth: AuthRequirement = "public";
      let permission: string | undefined;
      let idempotent: string | undefined;
      let rateLimit: string | undefined;

      const authMatch = content.match(/auth:\s*["'](\w+)["']/);
      if (authMatch) {
        auth = authMatch[1] as AuthRequirement;
      } else if (openApiPath.includes("/admin/")) {
        auth = "staff";
      } else if (openApiPath.includes("/customer/")) {
        auth = "customer";
      } else if (openApiPath.includes("/finance/")) {
        auth = "staff";
      } else if (openApiPath.includes("/runner/")) {
        auth = "staff";
      } else if (openApiPath.includes("/qc/")) {
        auth = "staff";
      } else if (openApiPath.includes("/pos/")) {
        auth = "staff";
      } else if (openApiPath.includes("/logistics/")) {
        auth = "staff";
      }

      const permMatch = content.match(/permission:\s*["']([\w.]+)["']/);
      if (permMatch) {
        permission = permMatch[1];
      }

      const idempMatch = content.match(/idempotent:\s*["']([\w.-]+)["']/);
      if (idempMatch) {
        idempotent = idempMatch[1];
      }

      // Detect known rate limits
      if (openApiPath.includes("/verify")) {
        rateLimit = "5/min per device, 60/min per IP";
      } else if (openApiPath.includes("/otp/send")) {
        rateLimit = "3/10m per phone, 20/hr per IP";
      } else if (openApiPath.includes("/cart/reserve")) {
        rateLimit = "30/min per device";
      } else if (openApiPath.includes("/orders/checkout")) {
        rateLimit = "10/hr per customer flag";
      } else {
        const rlMatch = content.match(/limit:\s*(\d+).*?windowSec:\s*(\d+)/s);
        if (rlMatch) {
          rateLimit = `${rlMatch[1]} requests per ${rlMatch[2]}s`;
        }
      }

      const hasBody = ["POST", "PUT", "PATCH"].includes(method) && content.includes("body:");
      const hasQuery = content.includes("query:");
      const hasParams = paramNames.length > 0 || content.includes("params:");

      scanned.push({
        file: path.relative(process.cwd(), file).replace(/\\/g, "/"),
        method,
        path: openApiPath,
        auth,
        permission,
        idempotent,
        rateLimit,
        hasBody,
        hasQuery,
        hasParams,
        paramNames,
      });
    }
  }

  // Sort deterministically by path and method
  return scanned.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.method.localeCompare(b.method);
  });
}
