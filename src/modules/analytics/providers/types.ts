export interface AnalyticsConsent {
  analytics: boolean;
  marketing: boolean;
}

export interface StandardAnalyticsEvent {
  eventName: string;
  distinctId: string;
  userId?: string;
  anonymousId?: string;
  properties: Record<string, unknown>;
  timestamp: Date;
  consent: AnalyticsConsent;
  context?: {
    ip?: string;
    userAgent?: string;
    url?: string;
  };
}

export interface ProviderResult {
  success: boolean;
  provider: "POSTHOG" | "GA4" | "META";
  payload?: Record<string, unknown>;
  messageId?: string;
  error?: string;
  mockRecorded?: boolean;
}

export interface AnalyticsProvider {
  name: "POSTHOG" | "GA4" | "META";
  track(event: StandardAnalyticsEvent): Promise<ProviderResult>;
}
