import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // PostgreSQL Database
  DATABASE_URL: z.string().default("postgres://ncamart:ncamart_dev_pwd@localhost:5432/ncamart_dev"),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Meilisearch
  MEILI_HOST: z.string().default("http://localhost:7700"),
  MEILI_MASTER_KEY: z.string().default("ncamart_meili_master_key_local_dev"),

  // S3 / Cloudflare R2
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("auto"),
  S3_ACCESS_KEY_ID: z.string().default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
  S3_BUCKET_MEDIA: z.string().default("ncamart-media"),
  S3_BUCKET_PRIVATE: z.string().default("ncamart-private"),
  S3_BUCKET_AUDIT: z.string().default("ncamart-audit"),
  S3_PUBLIC_DOMAIN: z.string().default("http://localhost:9000/ncamart-media"),

  // Encryption & Auth Secrets
  APP_ENCRYPTION_KEY: z.string().min(32).default("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
  SESSION_SECRET: z.string().min(16).default("super-secret-session-token-ncamart-local-development-key"),

  // Mock services toggle
  MOCK_EXTERNAL_SERVICES: z
    .enum(["true", "false"])
    .default("true")
    .transform((val) => val === "true"),

  // SSLCommerz
  SSLCOMMERZ_STORE_ID: z.string().default("ncama_sandbox"),
  SSLCOMMERZ_STORE_PASS: z.string().default("ncama_sandbox@ssl"),
  SSLCOMMERZ_IS_SANDBOX: z
    .enum(["true", "false"])
    .default("true")
    .transform((val) => val === "true"),
  SSLCOMMERZ_IPN_ALLOWED_IPS: z.string().default(""),

  // Couriers
  STEADFAST_API_KEY: z.string().default("mock_steadfast_api_key"),
  STEADFAST_SECRET_KEY: z.string().default("mock_steadfast_secret"),
  PATHAO_CLIENT_ID: z.string().default("mock_pathao_client_id"),
  PATHAO_CLIENT_SECRET: z.string().default("mock_pathao_secret"),
  PATHAO_USERNAME: z.string().default("mock_pathao_user"),
  PATHAO_PASSWORD: z.string().default("mock_pathao_pwd"),
  REDX_ACCESS_TOKEN: z.string().default("mock_redx_token"),

  // Comms
  SMS_PROVIDER: z.string().default("mock"),
  SMS_API_KEY: z.string().default("mock_sms_api_key"),
  SMS_SENDER_ID: z.string().default("NCAMart"),
  WHATSAPP_API_TOKEN: z.string().default("mock_whatsapp_token"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default("mock_wa_phone_id"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_FROM: z.string().default("NCAMart <noreply@ncamart.com>"),

  // Turnstile
  TURNSTILE_SITE_KEY: z.string().default("1x00000000000000000000AA"),
  TURNSTILE_SECRET_KEY: z.string().default("1x0000000000000000000000000000000AA"),

  // Observability
  SENTRY_DSN: z.string().optional().default(""),
  POSTHOG_API_KEY: z.string().optional().default(""),
  POSTHOG_HOST: z.string().default("https://app.posthog.com"),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

export function loadEnv(raw: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const formatted = JSON.stringify(result.error.format(), null, 2);
    // Print clear diagnostic and crash at boot
    console.error("FATAL: Environment configuration validation failed:\n", formatted);
    throw new Error(`Invalid environment variables: ${formatted}`);
  }
  return result.data;
}

export function getEnv(): Env {
  if (!parsedEnv) {
    parsedEnv = loadEnv();
  }
  return parsedEnv;
}

export const env = getEnv();
