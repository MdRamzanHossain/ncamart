import { z } from "zod";

export const WHITELISTED_CLIENT_EVENTS = [
  "product_view",
  "add_to_cart",
  "checkout_started",
  "qr_scan",
] as const;

export type WhitelistedClientEventName = (typeof WHITELISTED_CLIENT_EVENTS)[number];

export const SERVER_KPI_EVENTS = [
  "order_placed",
  "payment_succeeded",
  "payment_failed",
  "verify_lookup",
  "rma_submitted",
  "rto",
  "preorder_milestone",
] as const;

export type ServerKpiEventName = (typeof SERVER_KPI_EVENTS)[number];

export const clientAnalyticsEventSchema = z.object({
  event_name: z.string().min(1).max(64),
  properties: z.record(z.unknown()).default({}),
  consent: z
    .object({
      analytics: z.boolean().default(false),
      marketing: z.boolean().default(false),
    })
    .default({ analytics: false, marketing: false }),
  anonymous_id: z.string().max(128).optional(),
  user_id: z.string().max(128).optional(),
  session_id: z.string().max(128).optional(),
});

export type ClientAnalyticsEventInput = z.infer<typeof clientAnalyticsEventSchema>;

export interface AnalyticsEventRecordDto {
  id: string;
  event_name: string;
  aggregate_type: string | null;
  aggregate_id: string | null;
  user_id: string | null;
  anonymous_id: string | null;
  properties: Record<string, unknown>;
  consent_status: "GRANTED" | "DENIED" | "STRICTLY_NECESSARY";
  forwarded_to: string[];
  created_at: string;
}

export interface SitemapAlternateDto {
  lang: "bn" | "en";
  href: string;
}

export interface SitemapEntryDto {
  loc: string;
  lastmod: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
  alternates: SitemapAlternateDto[];
}

export interface SitemapResponseDto {
  entries: SitemapEntryDto[];
  total: number;
  generated_at: string;
}

export interface FeedsGenerationResultDto {
  productsCount: number;
  googleXmlBytes: number;
  metaCsvBytes: number;
  googleXmlUrl: string;
  metaCsvUrl: string;
  generatedAt: string;
}
