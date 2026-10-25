import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { AnalyticsProvider, ProviderResult, StandardAnalyticsEvent } from "./types";

export interface MockPostHogRecord {
  event: string;
  distinctId: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export const memSentPostHog: MockPostHogRecord[] = [];

export function clearMemoryPostHogForTesting(): void {
  memSentPostHog.length = 0;
}

export class PostHogProvider implements AnalyticsProvider {
  name = "POSTHOG" as const;

  async track(event: StandardAnalyticsEvent): Promise<ProviderResult> {
    const apiKey = process.env.POSTHOG_API_KEY;
    const host = process.env.POSTHOG_HOST || "https://app.posthog.com";

    const payload = {
      api_key: apiKey || "mock_posthog_key",
      event: event.eventName,
      distinct_id: event.distinctId,
      properties: {
        ...event.properties,
        $lib: "ncamart-node",
        distinct_id: event.distinctId,
      },
      timestamp: event.timestamp.toISOString(),
    };

    if (env.MOCK_EXTERNAL_SERVICES || process.env.NODE_ENV === "test" || !apiKey) {
      memSentPostHog.push({
        event: event.eventName,
        distinctId: event.distinctId,
        properties: payload.properties,
        timestamp: payload.timestamp,
      });

      return {
        success: true,
        provider: "POSTHOG",
        payload,
        mockRecorded: true,
      };
    }

    try {
      const res = await fetch(`${host}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error({ status: res.status, errorText }, "PostHog capture API returned error");
        return {
          success: false,
          provider: "POSTHOG",
          error: `HTTP ${res.status}: ${errorText}`,
        };
      }

      return {
        success: true,
        provider: "POSTHOG",
        payload,
      };
    } catch (err) {
      logger.error({ err }, "PostHog network exception");
      return {
        success: false,
        provider: "POSTHOG",
        error: String(err),
      };
    }
  }
}
