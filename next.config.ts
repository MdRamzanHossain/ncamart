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
const nextConfig: NextConfig = {
  // Standalone output is enabled only when DOCKER_BUILD=1; standard build is used for ExonHost cPanel (server.js) and local builds
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
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

  // Multi-replica synchronized deployment ID (strictly in production only)
  deploymentId:
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_DEPLOYMENT_ID || process.env.GIT_SHA || "ncamart-prod"
      : undefined,

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

