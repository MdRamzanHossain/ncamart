import { ScannedRoute } from "./types";

export interface RouteMetadata {
  tag: string;
  summary: string;
  description: string;
}

export function getRouteMetadata(route: ScannedRoute): RouteMetadata {
  const p = route.path;
  const m = route.method;

  // 1. Tag detection
  let tag = "System & Utilities";
  if (p.startsWith("/api/v1/auth")) tag = "Authentication & Identity";
  else if (p.startsWith("/api/v1/customer")) tag = "Customer & Account";
  else if (p.startsWith("/api/v1/catalog")) tag = "Catalog & Search";
  else if (p.startsWith("/api/v1/cart")) tag = "Cart & Reservations";
  else if (p.startsWith("/api/v1/orders")) tag = "Orders & Fulfillment";
  else if (p.startsWith("/api/v1/payments")) tag = "Payments & Gateways";
  else if (p.startsWith("/api/v1/logistics")) tag = "Logistics & Courier";
  else if (p.startsWith("/api/v1/qc")) tag = "Quality Control & Seals";
  else if (p.startsWith("/api/v1/verify")) tag = "Trust & Seal Verification";
  else if (p.startsWith("/api/v1/pos")) tag = "Showroom Point of Sale";
  else if (p.startsWith("/api/v1/runner")) tag = "Field Runner Sourcing";
  else if (p.startsWith("/api/v1/rma")) tag = "Warranty & RMA Claims";
  else if (p.startsWith("/api/v1/media")) tag = "Media & Uploads";
  else if (p.startsWith("/api/v1/finance")) tag = "Finance, Ledger & Tax";
  else if (p.startsWith("/api/v1/reviews")) tag = "Customer Reviews";
  else if (p.startsWith("/api/v1/analytics")) tag = "Analytics & Feeds";
  else if (p.startsWith("/api/v1/admin")) tag = "Admin & Governance";
  else if (p.startsWith("/api/v1/geo")) tag = "Geo Hierarchy";
  else if (p.startsWith("/api/v1/events")) tag = "Realtime SSE Events";
  else if (p.startsWith("/api/v1/notifications")) tag = "Notifications";
  else if (p.startsWith("/api/v1/webhooks")) tag = "External Webhooks";
  else if (p.startsWith("/feeds")) tag = "Marketing Feeds";
  else if (p.startsWith("/api/v1/health")) tag = "System Health";
  else if (p.startsWith("/api/v1/seo")) tag = "SEO & Sitemaps";

  // 2. Summary generation
  let summary = `${m} ${p}`;
  const segments = p.split("/").filter(Boolean);
  const lastSeg = segments[segments.length - 1];
  const secondLastSeg = segments.length > 1 ? segments[segments.length - 2] : "";

  // Helper mappings
  const actionMap: Record<string, string> = {
    "send": "Send",
    "verify": "Verify",
    "login": "Staff Login",
    "logout": "Logout Session",
    "enroll": "Enroll",
    "confirm": "Confirm",
    "change": "Change",
    "reserve": "Create Reservation Hold",
    "validate": "Validate Cart Items",
    "checkout": "Place Order Checkout",
    "pay": "Initiate Order Payment",
    "cancel": "Cancel Order",
    "balance": "Pay Pre-Order Balance",
    "handover": "Handover Consignment / Items",
    "pack": "Pack Order & Verify Seals",
    "inspect": "QC Inspection",
    "mint-seal": "Mint Holographic Seal",
    "void-seal": "Request Seal Void",
    "walk-in-sale": "Process Showroom Walk-in Sale",
    "verify-pin": "Verify Pickup PIN",
    "anonymize": "Anonymize Customer Data",
    "suspend": "Suspend Supplier",
    "reactivate": "Reactivate Supplier",
    "archive": "Archive Catalog Product",
    "publish": "Publish Catalog Product",
    "approve": "Approve",
    "reject": "Reject",
    "submit": "Submit for Review",
    "execute": "Execute Manual Refund Payout",
    "reconcile": "Reconcile Cash Drawer",
    "courier-csv": "Upload Courier Settlement CSV",
  };

  if (actionMap[lastSeg]) {
    const target = secondLastSeg.replace(/\{(\w+)\}/, "Resource");
    summary = `${actionMap[lastSeg]} ${target.replace(/[-_]/g, " ")}`;
  } else if (m === "GET") {
    summary = `Get ${lastSeg.replace(/\{(\w+)\}/, "by ID").replace(/[-_]/g, " ")}`;
  } else if (m === "POST") {
    summary = `Create ${lastSeg.replace(/[-_]/g, " ")}`;
  } else if (m === "PUT") {
    summary = `Update ${lastSeg.replace(/[-_]/g, " ")}`;
  } else if (m === "DELETE") {
    summary = `Delete ${lastSeg.replace(/[-_]/g, " ")}`;
  }

  // Capitalize summary words
  summary = summary
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  // 3. Description generation
  let desc = `Handles **${m}** requests on \`${p}\`.\n\n`;
  desc += `- **Authentication:** ${route.auth.toUpperCase()}\n`;
  if (route.permission) {
    desc += `- **Required Permission:** \`${route.permission}\`\n`;
  }
  if (route.idempotent) {
    desc += `- **Idempotency:** Supported via \`Idempotency-Key\` header (Scope: \`${route.idempotent}\`)\n`;
  }
  if (route.rateLimit) {
    desc += `- **Rate Limit:** ${route.rateLimit}\n`;
  }
  desc += `- **Source File:** \`${route.file}\`\n`;

  return {
    tag,
    summary,
    description: desc,
  };
}
