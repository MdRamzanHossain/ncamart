import { describe, it, expect } from "vitest";
import { checkRateLimit, blockKey, isBlocked } from "../ratelimit";

describe("ratelimit.ts unit tests", () => {
  it("allows requests under the limit and tracks remaining quota", async () => {
    const key = "test-user-rate-limit";
    const res1 = await checkRateLimit(key, 3, 60);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await checkRateLimit(key, 3, 60);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await checkRateLimit(key, 3, 60);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);

    const res4 = await checkRateLimit(key, 3, 60);
    expect(res4.allowed).toBe(false);
    expect(res4.remaining).toBe(0);
    expect(res4.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("blocks and checks blocked keys", async () => {
    const blockKeyName = "blocked-suspicious-ip";
    expect(await isBlocked(blockKeyName)).toBe(false);

    await blockKey(blockKeyName, 60);
    expect(await isBlocked(blockKeyName)).toBe(true);
  });
});
