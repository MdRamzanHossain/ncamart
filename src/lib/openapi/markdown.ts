import { ScannedRoute } from "./types";
import { getRouteMetadata } from "./metadata";

export function generateApiMarkdown(scannedRoutes: ScannedRoute[]): string {
  const timestamp = new Date().toISOString();

  // Group routes by module tag
  const grouped = new Map<string, ScannedRoute[]>();
  for (const route of scannedRoutes) {
    const meta = getRouteMetadata(route);
    const list = grouped.get(meta.tag) || [];
    list.push(route);
    grouped.set(meta.tag, list);
  }

  let md = `# NCAMart REST API Specification & Endpoint Reference\n\n`;
  md += `**Document Version:** 2.0.0 (OpenAPI 3.1 Synchronized)  \n`;
  md += `**Last Generated:** ${timestamp}  \n`;
  md += `**Total Active Endpoints:** ${scannedRoutes.length}  \n`;
  md += `**Source of Truth:** \`docs/openapi.json\` (Generated via \`pnpm openapi:generate\`)  \n\n`;

  md += `## 1. Global Architectural Invariants\n\n`;
  md += `* **Monetary Representation:** Strictly integer paisa (\`1 BDT = 100 Paisa\`). Floating point values are strictly forbidden.\n`;
  md += `* **Percentages / Rates:** Strictly integer basis points (\`1% = 100 bp\`, e.g. 7.5% VAT = 750 bp).\n`;
  md += `* **Authentication Schemes:**\n`;
  md += `  * Customer & Staff Web Sessions: \`nca_sid\` HttpOnly, Secure, SameSite=Lax cookie.\n`;
  md += `  * Mobile / Headless / PWA Requests: HTTP Header \`Authorization: Bearer <session_token>\`.\n`;
  md += `  * Internal Worker & Webhook Ingestion: HTTP Header \`X-Internal-Secret: <HMAC_SECRET>\`.\n`;
  md += `* **Idempotency Standards:** All mutating POST/PUT endpoints support \`Idempotency-Key\` (UUIDv7) or \`X-Client-Mutation-Id\` for offline sync.\n`;
  md += `* **Uniform Error Envelope (RFC 7807):** All non-2xx responses conform to \`{ error: { code, message, status, details?, timestamp } }\`.\n\n`;

  md += `## 2. Active Endpoints Directory\n\n`;

  // Sort tags alphabetically
  const sortedTags = Array.from(grouped.keys()).sort();

  for (const tag of sortedTags) {
    const routes = grouped.get(tag)!;
    md += `### ${tag} (${routes.length} endpoints)\n\n`;
    md += `| Method | Path | Auth / Permission | Idempotent? | Rate Limit | Description |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const r of routes) {
      const meta = getRouteMetadata(r);
      const authStr = r.permission
        ? `${r.auth.toUpperCase()} (\`${r.permission}\`)`
        : r.auth.toUpperCase();
      const idempStr = r.idempotent ? `Yes (\`${r.idempotent}\`)` : "-";
      const rlStr = r.rateLimit ? r.rateLimit : "-";
      const cleanDesc = meta.summary.replace(/\|/g, "\\|");

      md += `| \`${r.method.padEnd(6)}\` | \`${r.path}\` | ${authStr} | ${idempStr} | ${rlStr} | ${cleanDesc} |\n`;
    }
    md += `\n`;
  }

  md += `## 3. Intentional Architectural Deviations Against \`api-spec.md\`\n\n`;
  md += `The following architectural enhancements and intentional deviations from the original \`api-spec.md\` v2.0 draft have been approved and recorded in \`docs/DECISIONS.md\`:\n\n`;

  md += `| # | Feature / Endpoint | Original \`api-spec.md\` Specification | Implemented Architectural Design | Rationale & \`DECISIONS.md\` Reference |\n`;
  md += `| :-: | :--- | :--- | :--- | :--- |\n`;

  md += `| 1 | **Pre-Order Balance COD Cap**<br>\`POST /orders/:id/balance\` | Allowed unrestricted COD balance payments | Strictly capped COD balance payments at ৳30,000 (3,000,000 paisa) with \`422 ERR_COD_NOT_ALLOWED\` | High-value courier COD carries severe courier cash handling and default risks. Pre-order balances $>৳30,000$ must be settled online or at the Nawabpur showroom counter. *(DECISIONS.md #33, PRD §3.3.4)* |\n`;

  md += `| 2 | **Public \`/verify\` Clone Alerts**<br>\`GET /verify/:sealId\` | Suggested showing clone suspicion banner to visitor | Returns standard valid seal metadata to public visitor; emits internal Class A incident alert to Super Admin | Revealing clone suspicion on public lookups tips off counterfeiters and causes panic for legitimate customers who bought genuine items. *(DECISIONS.md #38, PRD §3.2.3)* |\n`;

  md += `| 3 | **Showroom Walk-in Sale Lifecycle**<br>\`POST /pos/walk-in-sale\` | Multi-step transition through \`PENDING_PAYMENT\` | Created directly in terminal \`DELIVERED_COUNTER\` status | Walk-in counter sales involve immediate cash/card payment and physical unit handover on the spot; bypassing intermediary states accurately reflects physical reality. *(DECISIONS.md #29, #45, PRD §3.12)* |\n`;

  md += `| 4 | **Media Upload Strategy**<br>\`POST /media/uploads\` | Single presigned S3 PUT for all files | Dual-mode: Direct presigned PUT ($\le$ 10MB) vs. S3 multipart chunking ($>$ 10MB) | Ensures zero-latency uploads for smartphone RMA photos and receipts, while providing robust resumable chunking for large 300MB unboxing videos. *(DECISIONS.md #47, PRD §3.8.8)* |\n`;

  md += `| 5 | **Courier Webhook Aliases**<br>\`POST /webhooks/couriers/:courier\` | Single path under \`/webhooks/couriers/:courier\` | Dual mount: \`/api/v1/logistics/webhooks/:courier\` and \`/api/v1/webhooks/couriers/:courier\` | Backwards-compatibility with varying courier provider dashboard configuration formats (Steadfast, Pathao, RedX). *(DECISIONS.md #39)* |\n`;

  md += `| 6 | **Customer Data Anonymization**<br>\`POST /admin/customers/:id/anonymize\` | Hard \`DELETE\` customer record | Irreversible phone SHA-256 hashing and PII masking; preserves balanced journal entries and Mushak invoices | Statutory Bangladesh accounting and VAT compliance requires 6-year retention of sales ledgers, while honoring Customer Right to be Forgotten. *(DECISIONS.md #64, PRD §3.18)* |\n`;

  md += `| 7 | **Store Credit Expiry Accounting**<br>\`Daily 00:15 Asia/Dhaka Job\` | Mutation of historical store credit balance | Append-only negative \`EXPIRY\` entry with ledger reversal \`Dr 2020 / Cr 5400\` | Preserves immutable store credit log integrity without mutating historical rows or ledger lines. *(DECISIONS.md #27, PRD §3.14.6)* |\n`;

  md += `| 8 | **Cash Variance Accounting**<br>\`POST /finance/drawers/:id/reconcile\` | Credited to Miscellaneous Income | Credited directly to Operating Expense Account 5310 (Cash Variance) | Nets cash overages directly against shortages within operating expenses rather than segregating into non-operating income. *(DECISIONS.md #28, PRD §3.13)* |\n`;

  md += `| 9 | **Pre-Order Delay Choice Goodwill**<br>\`POST /orders/:id/preorder/delay-choice\` | Awarded immediately upon delay notification | Awarded upon physical arrival at Nawabpur godown (\`ARRIVED_GODOWN\`) | Preserves price lock while avoiding premature unearned credit distribution if customs or international cargo ultimately fails. *(DECISIONS.md #32, PRD §3.14)* |\n`;

  md += `| 10 | **Runner Sourcing Privacy**<br>\`GET /runner/tasks\` | Included customer shipping address | Zero customer PII in runner task DTOs (SKU, title, stall, max price only) | Protects customer privacy and prevents direct off-platform courier dispatch bypass. *(DECISIONS.md #35, PRD §3.9)* |\n`;

  md += `| 11 | **Partial Stockout Delivery Fee**<br>\`POST /orders/:id/lines/:lineId/stockout-choice\` | Pro-rata delivery fee reallocation | Delivery fee charged once only across partial stockout splits (EC-05) | Protects customer from additional delivery fees when Nawabpur stalls run out of secondary line items. *(DECISIONS.md #37, PRD §3.4.4)* |\n`;

  md += `| 12 | **Mushak 6.3 Tax Point Timing**<br>\`GET /finance/invoices/:id/mushak-6-3\` | Issued upon order creation | Issued at Revenue Recognition (Delivery / Counter Handover) | Mushak 6.3 VAT tax invoices with gapless fiscal-year serials are issued when ownership and goods transfer. *(DECISIONS.md #31, PRD §3.12)* |\n`;

  md += `| 13 | **Last SUPER_ADMIN Guard**<br>\`DELETE /admin/staff/:id\` | Standard RBAC check | System prevents deleting or revoking roles of the last active SUPER_ADMIN | Prevents catastrophic administrative lockout. *(DECISIONS.md #62, PRD §3.9)* |\n`;

  md += `| 14 | **RMA Media 180-Day Retention**<br>\`POST /rma/claims/:id/close\` | Indefinite media storage | Schedules linked unboxing videos and proofs for cleanup 180 days after closure | Reduces cloud storage bloat while exceeding the statutory Bangladesh consumer dispute window. *(DECISIONS.md #49, #55, PRD §3.8.8)* |\n\n`;

  md += `---\n*End of API Specification Documentation.*\n`;

  return md;
}
