import { AnalyticsProvider } from "./types";
import { PostHogProvider } from "./posthog";
import { GA4Provider } from "./ga4";
import { MetaConversionsApiProvider } from "./meta";

export * from "./types";
export * from "./hash";
export * from "./posthog";
export * from "./ga4";
export * from "./meta";

export interface AnalyticsProvidersBundle {
  posthog: PostHogProvider;
  ga4: GA4Provider;
  meta: MetaConversionsApiProvider;
}

export const defaultAnalyticsProviders: AnalyticsProvidersBundle = {
  posthog: new PostHogProvider(),
  ga4: new GA4Provider(),
  meta: new MetaConversionsApiProvider(),
};
