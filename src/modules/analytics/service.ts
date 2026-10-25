import crypto from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { putObject, getObject } from "@/lib/storage";
import { OutboxRow } from "@/db/infra";
import {
  ClientAnalyticsEventInput,
  clientAnalyticsEventSchema,
  WHITELISTED_CLIENT_EVENTS,
  SERVER_KPI_EVENTS,
  AnalyticsEventRecordDto,
  SitemapResponseDto,
  SitemapEntryDto,
  FeedsGenerationResultDto,
} from "./dto";
import { analyticsRepo } from "./repo";
import {
  OUTBOX_TO_ANALYTICS_EVENT_MAP,
  ANALYTICS_EVENTS,
} from "./events";
import {
  AnalyticsProvidersBundle,
  defaultAnalyticsProviders,
  StandardAnalyticsEvent,
} from "./providers";
import {
  buildGoogleMerchantXml,
  buildMetaCatalogCsv,
  FeedProductItem,
} from "./feeds";

// In-memory feed cache
let cachedGoogleXml: string | null = null;
let cachedMetaCsv: string | null = null;
let lastFeedGeneratedAt: Date | null = null;

export class AnalyticsService {
  private providers: AnalyticsProvidersBundle;

  constructor(providers: AnalyticsProvidersBundle = defaultAnalyticsProviders) {
    this.providers = providers;
  }

  setProvidersForTesting(custom: Partial<AnalyticsProvidersBundle>): void {
    this.providers = { ...this.providers, ...custom };
  }

  resetProviders(): void {
    this.providers = defaultAnalyticsProviders;
  }

  // --------------------------------------------------------------------------
  // 1. Client Event Ingestion (POST /api/v1/analytics/events)
  // --------------------------------------------------------------------------
  async trackClientEvent(
    rawInput: unknown,
    context?: { ip?: string; userAgent?: string; url?: string }
  ): Promise<{
    accepted: boolean;
    eventName: string;
    consentStatus: "GRANTED" | "DENIED" | "STRICTLY_NECESSARY";
    forwardedTo: string[];
    recordId?: string;
    reason?: string;
  }> {
    const parsed = clientAnalyticsEventSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        accepted: false,
        eventName: "unknown",
        consentStatus: "DENIED",
        forwardedTo: [],
        reason: "Invalid event schema",
      };
    }

    const input = parsed.data;

    // Check against whitelist
    const isWhitelisted = (WHITELISTED_CLIENT_EVENTS as readonly string[]).includes(
      input.event_name
    );
    if (!isWhitelisted) {
      return {
        accepted: false,
        eventName: input.event_name,
        consentStatus: "DENIED",
        forwardedTo: [],
        reason: `Event '${input.event_name}' is not in the client analytics whitelist`,
      };
    }

    const hasAnalyticsConsent = Boolean(input.consent.analytics);
    const now = new Date();
    const distinctId = input.user_id || input.anonymous_id || `anon_${crypto.randomUUID()}`;

    // Respect Consent:
    // If client consent is false, third-party forwarding is DROPPED.
    const consentStatus = hasAnalyticsConsent ? "GRANTED" : "DENIED";
    const forwardedTo: string[] = [];

    const standardEvent: StandardAnalyticsEvent = {
      eventName: input.event_name,
      distinctId,
      userId: input.user_id,
      anonymousId: input.anonymous_id,
      properties: input.properties,
      timestamp: now,
      consent: input.consent,
      context,
    };

    if (hasAnalyticsConsent) {
      // Forward to third-party providers (PostHog, GA4, Meta CAPI)
      const results = await Promise.allSettled([
        this.providers.posthog.track(standardEvent),
        this.providers.ga4.track(standardEvent),
        this.providers.meta.track(standardEvent),
      ]);

      for (const res of results) {
        if (res.status === "fulfilled" && res.value.success) {
          forwardedTo.push(res.value.provider);
        }
      }
    } else {
      logger.info(
        { eventName: input.event_name, distinctId },
        "Third-party forwarding dropped due to missing analytics consent"
      );
    }

    // Record internal copy for KPIs with the consent decision noted
    const record = await analyticsRepo.recordEvent(undefined, {
      eventName: input.event_name,
      aggregateType: "CLIENT",
      aggregateId: input.session_id || distinctId,
      userId: input.user_id || null,
      anonymousId: input.anonymous_id || null,
      properties: {
        ...input.properties,
        _clientConsent: input.consent,
      },
      consentStatus,
      forwardedTo,
      createdAt: now,
    });

    return {
      accepted: true,
      eventName: input.event_name,
      consentStatus,
      forwardedTo,
      recordId: record.id,
    };
  }

  // --------------------------------------------------------------------------
  // 2. Server-Side Pipeline (Outbox -> Analytics Event)
  // --------------------------------------------------------------------------
  async handleOutboxEvent(outboxEvent: {
    id?: string;
    type: string;
    aggregateType?: string | null;
    aggregateId?: string | null;
    payload?: Record<string, unknown>;
    createdAt?: Date;
  }): Promise<{
    processed: boolean;
    eventName?: string;
    consentStatus: "GRANTED" | "DENIED" | "STRICTLY_NECESSARY";
    forwardedTo: string[];
  }> {
    const mappedEventName = OUTBOX_TO_ANALYTICS_EVENT_MAP[outboxEvent.type];
    if (!mappedEventName) {
      return {
        processed: false,
        consentStatus: "STRICTLY_NECESSARY",
        forwardedTo: [],
      };
    }

    const payload = outboxEvent.payload || {};
    const userId = (payload.customerId as string) || (payload.userId as string);
    const now = outboxEvent.createdAt || new Date();
    const distinctId = userId || outboxEvent.aggregateId || `srv_${crypto.randomUUID()}`;

    // Server-side events:
    // Revenue-critical server events are strictly-necessary KPIs.
    // By default, stored internally without third-party forwarding unless analytics consent is explicit.
    const hasExplicitConsent = Boolean(payload.analyticsConsent);
    const consentStatus = hasExplicitConsent ? "GRANTED" : "STRICTLY_NECESSARY";
    const forwardedTo: string[] = [];

    const standardEvent: StandardAnalyticsEvent = {
      eventName: mappedEventName,
      distinctId,
      userId,
      properties: {
        ...payload,
        aggregateType: outboxEvent.aggregateType,
        aggregateId: outboxEvent.aggregateId,
      },
      timestamp: now,
      consent: {
        analytics: hasExplicitConsent,
        marketing: Boolean(payload.marketingConsent),
      },
    };

    if (hasExplicitConsent) {
      const results = await Promise.allSettled([
        this.providers.posthog.track(standardEvent),
        this.providers.ga4.track(standardEvent),
        this.providers.meta.track(standardEvent),
      ]);

      for (const res of results) {
        if (res.status === "fulfilled" && res.value.success) {
          forwardedTo.push(res.value.provider);
        }
      }
    } else {
      // Kept internally without third-party forwarding
      logger.info(
        { eventName: mappedEventName, outboxType: outboxEvent.type },
        "Server KPI recorded internally without third-party forwarding (strictly necessary)"
      );
    }

    await analyticsRepo.recordEvent(undefined, {
      eventName: mappedEventName,
      aggregateType: outboxEvent.aggregateType || null,
      aggregateId: outboxEvent.aggregateId || null,
      userId: userId || null,
      properties: standardEvent.properties,
      consentStatus,
      forwardedTo,
      createdAt: now,
    });

    return {
      processed: true,
      eventName: mappedEventName,
      consentStatus,
      forwardedTo,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Marketing Feeds Generation (Hourly Job -> R2)
  // --------------------------------------------------------------------------
  async generateAndUploadFeeds(now = new Date()): Promise<FeedsGenerationResultDto> {
    const items = await analyticsRepo.getFeedItems();

    const baseUrl = env.APP_BASE_URL || "https://ncamart.com";
    const googleXml = buildGoogleMerchantXml(items, baseUrl);
    const metaCsv = buildMetaCatalogCsv(items, baseUrl);

    // 1. Upload Google XML to R2 storage
    await putObject(
      env.S3_BUCKET_PUBLIC,
      "feeds/google.xml",
      googleXml,
      "application/xml; charset=utf-8"
    );

    // 2. Upload Meta CSV to R2 storage
    await putObject(
      env.S3_BUCKET_PUBLIC,
      "feeds/meta.csv",
      metaCsv,
      "text/csv; charset=utf-8"
    );

    // 3. Update in-memory caches
    cachedGoogleXml = googleXml;
    cachedMetaCsv = metaCsv;
    lastFeedGeneratedAt = now;

    const googleXmlBytes = Buffer.byteLength(googleXml, "utf-8");
    const metaCsvBytes = Buffer.byteLength(metaCsv, "utf-8");

    logger.info(
      {
        productsCount: items.length,
        googleXmlBytes,
        metaCsvBytes,
        generatedAt: now.toISOString(),
      },
      "Generated and uploaded Google Merchant XML & Meta Catalog CSV to storage"
    );

    return {
      productsCount: items.length,
      googleXmlBytes,
      metaCsvBytes,
      googleXmlUrl: `${baseUrl}/feeds/google.xml`,
      metaCsvUrl: `${baseUrl}/feeds/meta.csv`,
      generatedAt: now.toISOString(),
    };
  }

  async getGoogleMerchantXml(): Promise<string> {
    if (cachedGoogleXml) {
      return cachedGoogleXml;
    }

    // Try fetching from storage
    const obj = await getObject(env.S3_BUCKET_PUBLIC, "feeds/google.xml");
    if (obj) {
      cachedGoogleXml = obj.body.toString("utf-8");
      return cachedGoogleXml;
    }

    // Generate on demand
    const result = await this.generateAndUploadFeeds();
    return cachedGoogleXml!;
  }

  async getMetaCatalogCsv(): Promise<string> {
    if (cachedMetaCsv) {
      return cachedMetaCsv;
    }

    const obj = await getObject(env.S3_BUCKET_PUBLIC, "feeds/meta.csv");
    if (obj) {
      cachedMetaCsv = obj.body.toString("utf-8");
      return cachedMetaCsv;
    }

    await this.generateAndUploadFeeds();
    return cachedMetaCsv!;
  }

  // --------------------------------------------------------------------------
  // 4. Sitemap Entries (GET /api/v1/seo/sitemap-entries)
  // --------------------------------------------------------------------------
  async getSitemapEntries(baseUrl = env.APP_BASE_URL || "https://ncamart.com"): Promise<SitemapResponseDto> {
    const data = await analyticsRepo.getSitemapData();
    const entries: SitemapEntryDto[] = [];

    // Homepage entry
    entries.push({
      loc: `${baseUrl}/`,
      lastmod: new Date().toISOString(),
      changefreq: "daily",
      priority: 1.0,
      alternates: [
        { lang: "bn", href: `${baseUrl}/` },
        { lang: "en", href: `${baseUrl}/en` },
      ],
    });

    // Category entries
    for (const cat of data.categories) {
      entries.push({
        loc: `${baseUrl}/catalog/categories/${cat.slug}`,
        lastmod: cat.updatedAt.toISOString(),
        changefreq: "weekly",
        priority: 0.8,
        alternates: [
          { lang: "bn", href: `${baseUrl}/catalog/categories/${cat.slug}` },
          { lang: "en", href: `${baseUrl}/en/catalog/categories/${cat.slug}` },
        ],
      });
    }

    // Product entries
    for (const prod of data.products) {
      entries.push({
        loc: `${baseUrl}/catalog/products/${prod.slug}`,
        lastmod: prod.updatedAt.toISOString(),
        changefreq: "daily",
        priority: 0.9,
        alternates: [
          { lang: "bn", href: `${baseUrl}/catalog/products/${prod.slug}` },
          { lang: "en", href: `${baseUrl}/en/catalog/products/${prod.slug}` },
        ],
      });
    }

    return {
      entries,
      total: entries.length,
      generated_at: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  async listEvents(filter: {
    eventName?: string;
    aggregateId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    return analyticsRepo.listEvents(undefined, filter);
  }
}

export const analyticsService = new AnalyticsService();
