import { describe, it, expect } from "vitest";
import { beginIdempotency, completeIdempotency } from "../idempotency";
import { BusinessError, ConflictError } from "../errors";

describe("idempotency unit tests", () => {
  const scope = "CHECKOUT";
  const key = "idem-test-key-1001";
  const payloadHash1 = "hash-payload-abc-1";
  const payloadHash2 = "hash-payload-xyz-2";

  it("returns proceed for first request with new key", async () => {
    const res = await beginIdempotency(key, scope, payloadHash1);
    expect(res.action).toBe("proceed");
  });

  it("throws ERR_IDEMPOTENCY_IN_PROGRESS (409) if the same key is called while still in progress", async () => {
    const inProgressKey = "idem-key-in-progress";
    await beginIdempotency(inProgressKey, scope, payloadHash1);

    await expect(
      beginIdempotency(inProgressKey, scope, payloadHash1)
    ).rejects.toThrow(ConflictError);
  });

  it("throws ERR_IDEMPOTENCY_MISMATCH (422) if key is reused with different payload", async () => {
    const mismatchKey = "idem-key-mismatch";
    await beginIdempotency(mismatchKey, scope, payloadHash1);

    await expect(
      beginIdempotency(mismatchKey, scope, payloadHash2)
    ).rejects.toThrow(BusinessError);

    try {
      await beginIdempotency(mismatchKey, scope, payloadHash2);
    } catch (err: unknown) {
      const e = err as BusinessError;
      expect(e.code).toBe("ERR_IDEMPOTENCY_MISMATCH");
      expect(e.status).toBe(422);
    }
  });

  it("replays response when key was completed with identical payload hash", async () => {
    const replayKey = "idem-key-replay";
    await beginIdempotency(replayKey, scope, payloadHash1);
    await completeIdempotency(replayKey, scope, 201, { orderId: "ORD-2026-99999", success: true });

    const replayRes = await beginIdempotency(replayKey, scope, payloadHash1);
    expect(replayRes.action).toBe("replay");
    if (replayRes.action === "replay") {
      expect(replayRes.status).toBe(201);
      const body = replayRes.body as { orderId: string };
      expect(body.orderId).toBe("ORD-2026-99999");
    }
  });
});
