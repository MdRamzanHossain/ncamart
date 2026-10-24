// NCAMart Database Schema Barrel
// Aggregates Drizzle schema definitions across domain modules

export * from "@/modules/identity/schema";
export * from "@/modules/catalog/schema";
export * from "@/modules/inventory/schema";
export * from "@/modules/orders/schema";
export * from "@/modules/preorder/schema";
export * from "@/modules/payments/schema";
export * from "@/modules/ledger/schema";
export * from "@/modules/logistics/schema";
export * from "@/modules/sourcing/schema";
export * from "@/modules/trust/schema";
export * from "@/modules/rma/schema";
export * from "@/modules/promotions/schema";
export * from "@/modules/pos/schema";
export * from "@/modules/finance/schema";
export * from "@/modules/notifications/schema";
export * from "@/modules/search/schema";
export * from "@/modules/analytics/schema";
export * from "@/modules/audit/schema";
export * from "@/modules/media/schema";
export * from "@/modules/engagement/schema";
export * from "@/modules/settings/schema";
export * from "@/db/infra";
