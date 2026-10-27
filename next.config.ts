import type { NextConfig } from "next";

/**
 * Multi-Replica Production Next.js Configuration
 * 
 * Multi-replica requirements (architechture.md §17.2):
 * 1. Shared ISR & Data Cache via Redis-backed cacheHandler (redisCacheHandler.cjs)
 * 2. Synchronized NEXT_SERVER_ACTIONS_ENCRYPTION_KEY across all web replicas
 *    to prevent hydration / decryption mismatch errors when Server Actions execute across replicas.
 * 3. Identical NEXT_DEPLOYMENT_ID (or GIT_SHA) to ensure chunk assets match across all replicas.
 */
const isWindows = process.platform === "win32";

const nextConfig: NextConfig = {
  // Standalone output is used in Linux Docker containers; disabled on Windows virtual drives to prevent EINVAL filesystem tracing errors
  output: isWindows && process.env.DOCKER_BUILD !== "1" ? undefined : "standalone",
  serverExternalPackages: ["bullmq", "ioredis", "pg", "argon2"],
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    // Typecheck is strictly verified in CI pipeline
    ignoreBuildErrors: true,
  },
  eslint: {
    // Lint is strictly verified in CI pipeline
    ignoreDuringBuilds: true,
  },

  // Multi-replica synchronized deployment ID
  deploymentId: process.env.NEXT_DEPLOYMENT_ID || process.env.GIT_SHA || "ncamart-prod",

  // Multi-replica shared cache handler (Redis) - only active if REDIS_URL and ENABLE_REDIS_CACHE are enabled
  cacheHandler:
    process.env.NODE_ENV === "production" && process.env.ENABLE_REDIS_CACHE === "true"
      ? require.resolve("./src/lib/cache/redisCacheHandler.cjs")
      : undefined,

  // Ensure Redis cache handler is bundled in standalone output
  outputFileTracingIncludes: {
    "/**": ["./src/lib/cache/redisCacheHandler.cjs"],
  },
};

export default nextConfig;

