import { checkRateLimit, blockKey, isBlocked } from "@/lib/ratelimit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface VerifyRateLimitResult {
  allowed: boolean;
  blocked: boolean;
  challengeRequired: boolean;
  retryAfterSec: number;
}

/**
 * Verify Cloudflare Turnstile captcha token.
 * In development, test, or when MOCK_EXTERNAL_SERVICES is enabled,
 * any non-empty string that is not "invalid" or "fail" is treated as valid.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  clientIp?: string
): Promise<boolean> {
  if (!token || token.trim().length === 0) {
    return false;
  }

  const cleanToken = token.trim();
  if (cleanToken === "invalid" || cleanToken === "fail") {
    return false;
  }

  if (env.MOCK_EXTERNAL_SERVICES || process.env.NODE_ENV === "test") {
    return true;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", env.TURNSTILE_SECRET_KEY);
    formData.append("response", cleanToken);
    if (clientIp) formData.append("remoteip", clientIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Turnstile siteverify returned non-200");
      return false;
    }

    const data = (await res.json()) as { success: boolean };
    return Boolean(data.success);
  } catch (err) {
    logger.error({ err }, "Turnstile siteverify network error");
    return false;
  }
}

/**
 * CGNAT-safe verification rate limiter.
 * - Max 5 requests/minute per device (nca_did)
 * - Max 60 requests/minute per client IP
 * - Turnstile challenge allows bypassing on completion
 * - 3 rate limit exceeds in 10 minutes results in a 15-minute block
 */
export async function checkVerifyRateLimit(params: {
  deviceId: string;
  ip: string;
  turnstileToken?: string | null;
}): Promise<VerifyRateLimitResult> {
  const { deviceId, ip, turnstileToken } = params;

  // 1. Check if device or IP is currently blocked
  const devBlocked = await isBlocked(`verify:blocked:dev:${deviceId}`);
  const ipBlocked = await isBlocked(`verify:blocked:ip:${ip}`);
  if (devBlocked || ipBlocked) {
    return {
      allowed: false,
      blocked: true,
      challengeRequired: false,
      retryAfterSec: 900,
    };
  }

  // 2. If valid Turnstile token is presented, allow access through
  if (turnstileToken) {
    const isValid = await verifyTurnstileToken(turnstileToken, ip);
    if (isValid) {
      return {
        allowed: true,
        blocked: false,
        challengeRequired: false,
        retryAfterSec: 0,
      };
    }
  }

  // 3. Check sliding-window rate limits:
  // Device limit: 5 / min (window 60s)
  const devLimitRes = await checkRateLimit(`verify:dev:${deviceId}`, 5, 60);
  if (!devLimitRes.allowed) {
    // Record abuse violation (3 exceeds in 600s = 10 min -> 15 min block)
    const abuseRes = await checkRateLimit(`verify:abuse:dev:${deviceId}`, 2, 600);
    if (!abuseRes.allowed) {
      await blockKey(`verify:blocked:dev:${deviceId}`, 900);
      await blockKey(`verify:blocked:ip:${ip}`, 900);
      return {
        allowed: false,
        blocked: true,
        challengeRequired: false,
        retryAfterSec: 900,
      };
    }

    return {
      allowed: false,
      blocked: false,
      challengeRequired: true,
      retryAfterSec: devLimitRes.retryAfterSec,
    };
  }

  // IP limit: 60 / min (window 60s)
  const ipLimitRes = await checkRateLimit(`verify:ip:${ip}`, 60, 60);
  if (!ipLimitRes.allowed) {
    const abuseRes = await checkRateLimit(`verify:abuse:ip:${ip}`, 2, 600);
    if (!abuseRes.allowed) {
      await blockKey(`verify:blocked:dev:${deviceId}`, 900);
      await blockKey(`verify:blocked:ip:${ip}`, 900);
      return {
        allowed: false,
        blocked: true,
        challengeRequired: false,
        retryAfterSec: 900,
      };
    }

    return {
      allowed: false,
      blocked: false,
      challengeRequired: true,
      retryAfterSec: ipLimitRes.retryAfterSec,
    };
  }

  return {
    allowed: true,
    blocked: false,
    challengeRequired: false,
    retryAfterSec: 0,
  };
}

/**
 * Extracts geo district from Cloudflare / proxy headers without fingerprinting.
 */
export function resolveGeoDistrict(headers: Headers): string | null {
  const customDistrict = headers.get("x-geo-district") || headers.get("x-mock-district");
  if (customDistrict && customDistrict.trim().length > 0) {
    return customDistrict.trim();
  }

  const cfRegion = headers.get("cf-region");
  const cfCity = headers.get("cf-ipcity");
  if (cfCity && cfCity.trim().length > 0) {
    return cfCity.trim();
  }
  if (cfRegion && cfRegion.trim().length > 0) {
    return cfRegion.trim();
  }

  return null;
}
