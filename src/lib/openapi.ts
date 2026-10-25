import fs from "fs";
import path from "path";
import { generateOpenApiSpec } from "./openapi/registry";
import { generateApiMarkdown } from "./openapi/markdown";

export async function generateOpenApiFiles() {
  console.log("========================================================");
  console.log("          NCAMart OpenAPI 3.1 & API.md Generator        ");
  console.log("========================================================");

  const startTime = Date.now();
  const { document, scannedRoutes } = generateOpenApiSpec();

  // 1. Write docs/openapi.json
  const openApiPath = path.resolve(process.cwd(), "docs/openapi.json");
  fs.mkdirSync(path.dirname(openApiPath), { recursive: true });
  fs.writeFileSync(openApiPath, JSON.stringify(document, null, 2), "utf8");

  // 2. Write docs/API.md
  const markdownPath = path.resolve(process.cwd(), "docs/API.md");
  const markdownContent = generateApiMarkdown(scannedRoutes);
  fs.writeFileSync(markdownPath, markdownContent, "utf8");

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const pathCount = Object.keys(document.paths || {}).length;

  console.log(`OpenAPI Version:    ${document.openapi}`);
  console.log(`Endpoints Generated:${scannedRoutes.length} route operations`);
  console.log(`Unique Path Routes: ${pathCount}`);
  console.log(`OpenAPI Output:     ${path.relative(process.cwd(), openApiPath)}`);
  console.log(`API.md Output:      ${path.relative(process.cwd(), markdownPath)}`);
  console.log(`Completed in:       ${elapsed}s`);
  console.log("========================================================\n");

  return { document, scannedRoutes, openApiPath, markdownPath };
}

// Run immediately if executed directly via CLI
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("openapi.ts")) {
  generateOpenApiFiles().catch((err) => {
    console.error("Failed to generate OpenAPI specification:", err);
    process.exit(1);
  });
}
