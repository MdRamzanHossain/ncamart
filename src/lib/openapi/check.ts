import { scanAllRoutes } from "./scanner";
import { generateOpenApiSpec } from "./registry";

export function checkOpenApiCoverage(): {
  totalScanned: number;
  totalRegistered: number;
  missing: { file: string; method: string; path: string }[];
} {
  const scanned = scanAllRoutes();
  const { document } = generateOpenApiSpec();

  const missing: { file: string; method: string; path: string }[] = [];

  for (const s of scanned) {
    const pathItem = document.paths?.[s.path];
    if (!pathItem) {
      missing.push({ file: s.file, method: s.method, path: s.path });
      continue;
    }

    const methodLower = s.method.toLowerCase();
    if (!(pathItem as any)[methodLower]) {
      missing.push({ file: s.file, method: s.method, path: s.path });
    }
  }

  return {
    totalScanned: scanned.length,
    totalRegistered: scanned.length - missing.length,
    missing,
  };
}

export async function runCiCheck(): Promise<void> {
  console.log("========================================================");
  console.log("           NCAMart OpenAPI CI Completeness Check        ");
  console.log("========================================================");

  const { totalScanned, totalRegistered, missing } = checkOpenApiCoverage();

  console.log(`Total Route Handlers Discovered: ${totalScanned}`);
  console.log(`Successfully Registered:         ${totalRegistered}`);

  if (missing.length > 0) {
    console.error(`\n❌ CI FAILURE: ${missing.length} route handler(s) missing from OpenAPI registry!`);
    console.error("Missing routes:");
    for (const m of missing) {
      console.error(`  - [${m.method.padEnd(6)}] ${m.path.padEnd(35)} (${m.file})`);
    }
    console.error("\nPlease update your OpenAPI registry or route definitions to resolve.\n");
    process.exit(1);
  }

  console.log("\n✅ CI SUCCESS: All route handlers are verified registered in OpenAPI!\n");
  console.log("========================================================\n");
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("check.ts")) {
  runCiCheck().catch((err) => {
    console.error("CI check crashed:", err);
    process.exit(1);
  });
}
