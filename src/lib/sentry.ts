import * as Sentry from "@sentry/nextjs";
import { env } from "./env";
import { logger } from "./logger";

const isConfigured = Boolean(env.SENTRY_DSN && env.SENTRY_DSN.trim() !== "");

const release =
  process.env.SENTRY_RELEASE ||
  process.env.NEXT_DEPLOYMENT_ID ||
  process.env.GIT_SHA ||
  "ncamart@0.1.0";

if (isConfigured) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
    serverName: process.env.HOSTNAME || "ncamart-node",
    initialScope: {
      tags: {
        deployment_id: process.env.NEXT_DEPLOYMENT_ID || "unknown",
        process_type: process.env.PROCESS_TYPE || "web",
      },
    },
  });
  logger.info({ release }, "Sentry monitoring initialized with release tagging");
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
