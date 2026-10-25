import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { AnalyticsProvider, ProviderResult, StandardAnalyticsEvent } from "./types";

export interface MockGA4Record {
  clientId: string;
  userId?: string;
  eventName: string;
  params: Record<string, unknown>;
  timestamp: string;
}

export const memSentGA4: MockGA4Record[] = [];

export function clearMemoryGA4ForTesting(): void {
  memSentGA4.length = 0;
}

export class GA4Provider implements AnalyticsProvider {
  name = "GA4" as const;

  async track(event: StandardAnalyticsEvent): Promise<ProviderResult> {
    const measurementId = process.env.GA4_MEASUREMENT_ID;
    const apiSecret = process.env.GA4_API_SECRET;

    // GA4 requires event names to be alphanumeric and underscores only
    const normalizedEventName = event.eventName.replace(/[^a-zA-Z0-9_]/g, "_");

    const payload = {
      client_id: event.distinctId || "anonymous_client",
      user_id: event.userId,
      timestamp_micros: String(event.timestamp.getTime() * 1000),
      events: [
        {
          name: normalizedEventName,
          params: {
            ...event.properties,
          },
        },
      ],
    };

    if (
      env.MOCK_EXTERNAL_SERVICES ||
      process.env.NODE_ENV === "test" ||
      !measurementId ||
      !apiSecret
    ) {
      memSentGA4.push({
        clientId: payload.client_id,
        userId: payload.user_id,
        eventName: normalizedEventName,
        params: event.properties,
        timestamp: event.timestamp.toISOString(),
      });

      return {
        success: true,
        provider: "GA4",
        payload,
        mockRecorded: true,
      };
    }

    try {
      const url = `https://www.google-analytics.com/mp/collect?api_secret=${apiSecret}&measurement_id=${measurementId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error({ status: res.status, errorText }, "GA4 measurement protocol returned error");
        return {
          success: false,
          provider: "GA4",
          error: `HTTP ${res.status}: ${errorText}`,
        };
      }

      return {
        success: true,
        provider: "GA4",
        payload,
      };
    } catch (err) {
      logger.error({ err }, "GA4 network exception");
      return {
        success: false,
        provider: "GA4",
        error: String(err),
      };
    }
  }
}
