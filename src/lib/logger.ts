import pino from "pino";
import { env } from "./env";

const isDev = env.NODE_ENV !== "production";

export const logger = pino({
  level: env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: {
    service: "ncamart-backend",
    env: env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "phone",
      "phoneNumber",
      "mobile",
      "address",
      "token",
      "secret",
      "password",
      "key",
      "*.phone",
      "*.phoneNumber",
      "*.mobile",
      "*.address",
      "*.token",
      "*.secret",
      "*.password",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  transport: undefined,
});
