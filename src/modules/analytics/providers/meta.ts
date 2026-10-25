import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { AnalyticsProvider, ProviderResult, StandardAnalyticsEvent } from "./types";
import { hashEmailForMeta, hashPhoneForMeta, hashTextForMeta, sha256Hex } from "./hash";

export interface MockMetaCapiRecord {
  eventName: string;
  eventTime: number;
  userData: {
    em?: string[];
    ph?: string[];
    fn?: string[];
    ln?: string[];
    ct?: string[];
    country?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    external_id?: string[];
  };
  customData: Record<string, unknown>;
}

export const memSentMeta: MockMetaCapiRecord[] = [];

export function clearMemoryMetaForTesting(): void {
  memSentMeta.length = 0;
}

export class MetaConversionsApiProvider implements AnalyticsProvider {
  name = "META" as const;

  async track(event: StandardAnalyticsEvent): Promise<ProviderResult> {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    const email = (event.properties.email as string) || (event.properties.customerEmail as string);
    const phone = (event.properties.phone as string) || (event.properties.customerPhone as string);
    const firstName = event.properties.firstName as string;
    const lastName = event.properties.lastName as string;
    const city = (event.properties.city as string) || (event.properties.district as string);

    const hashedEmail = hashEmailForMeta(email);
    const hashedPhone = hashPhoneForMeta(phone);
    const hashedFn = hashTextForMeta(firstName);
    const hashedLn = hashTextForMeta(lastName);
    const hashedCity = hashTextForMeta(city);
    const hashedExternalId = event.userId ? sha256Hex(event.userId) : undefined;

    const userData: MockMetaCapiRecord["userData"] = {
      client_ip_address: event.context?.ip,
      client_user_agent: event.context?.userAgent,
    };

    if (hashedEmail) userData.em = [hashedEmail];
    if (hashedPhone) userData.ph = [hashedPhone];
    if (hashedFn) userData.fn = [hashedFn];
    if (hashedLn) userData.ln = [hashedLn];
    if (hashedCity) userData.ct = [hashedCity];
    if (hashedExternalId) userData.external_id = [hashedExternalId];

    // Meta Standard Event Names Mapping
    let metaEventName = event.eventName;
    if (event.eventName === "product_view") metaEventName = "ViewContent";
    else if (event.eventName === "add_to_cart") metaEventName = "AddToCart";
    else if (event.eventName === "checkout_started") metaEventName = "InitiateCheckout";
    else if (event.eventName === "order_placed" || event.eventName === "payment_succeeded") metaEventName = "Purchase";

    const eventTime = Math.floor(event.timestamp.getTime() / 1000);

    const singleEventData = {
      event_name: metaEventName,
      event_time: eventTime,
      action_source: "website" as const,
      event_source_url: event.context?.url || "https://ncamart.com",
      user_data: userData,
      custom_data: {
        ...event.properties,
        currency: (event.properties.currency as string) || "BDT",
        value: typeof event.properties.total === "number" ? event.properties.total : undefined,
      },
    };

    const payload = {
      data: [singleEventData],
    };

    if (
      env.MOCK_EXTERNAL_SERVICES ||
      process.env.NODE_ENV === "test" ||
      !pixelId ||
      !accessToken
    ) {
      memSentMeta.push({
        eventName: metaEventName,
        eventTime,
        userData,
        customData: singleEventData.custom_data,
      });

      return {
        success: true,
        provider: "META",
        payload,
        mockRecorded: true,
      };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error({ status: res.status, errorText }, "Meta CAPI returned error");
        return {
          success: false,
          provider: "META",
          error: `HTTP ${res.status}: ${errorText}`,
        };
      }

      return {
        success: true,
        provider: "META",
        payload,
      };
    } catch (err) {
      logger.error({ err }, "Meta CAPI network exception");
      return {
        success: false,
        provider: "META",
        error: String(err),
      };
    }
  }
}
