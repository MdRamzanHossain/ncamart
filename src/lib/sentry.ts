import * as Sentry from "@sentry/nextjs";
import { env } from "./env";
import { logger } from "./logger";

const isConfigured = Boolean(env.SENTRY_DSN && env.SENTRY_DSN.trim() !== "");

if (isConfigured) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
  logger.info("Sentry monitoring initialized");
} else {
  logger.debug("Sentry DSN not provided; running with no-op telemetry");
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (isConfigured) {
    Sentry.captureException(err, { extra: context });
  } else {
    logger.error({ err, ...context }, "Captured error (Sentry no-op)");
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = "info"): void {
  if (isConfigured) {
    Sentry.captureMessage(message, level);
  } else {
    logger.info({ message, level }, "Captured message (Sentry no-op)");
  }
}
