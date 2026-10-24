import { describe, it, expect } from "vitest";
import {
  BusinessError,
  NotFoundError,
  RateLimitError,
  toErrorEnvelope,
  ERROR_CODES,
} from "../errors";

describe("errors.ts unit tests", () => {
  it("maps error codes to appropriate default status codes", () => {
    expect(ERROR_CODES.ERR_VALIDATION).toBe(400);
    expect(ERROR_CODES.ERR_UNAUTHENTICATED).toBe(401);
    expect(ERROR_CODES.ERR_FORBIDDEN).toBe(403);
    expect(ERROR_CODES.ERR_NOT_FOUND).toBe(404);
    expect(ERROR_CODES.ERR_CONFLICT).toBe(409);
    expect(ERROR_CODES.ERR_ILLEGAL_TRANSITION).toBe(409);
    expect(ERROR_CODES.ERR_RATE_LIMITED).toBe(429);
  });

  it("constructs BusinessError with code, message and status", () => {
    const err = new BusinessError("ERR_MIXED_CART_DISALLOWED", "Mixed tier cart items disallowed", {
      cartId: "cart-1",
    });
    expect(err.code).toBe("ERR_MIXED_CART_DISALLOWED");
    expect(err.status).toBe(422);
    expect(err.details.cartId).toBe("cart-1");
  });

  it("formats standard error envelope", () => {
    const err = new NotFoundError("Product", { id: "sku-123" });
    const envelope = toErrorEnvelope(err);

    expect(envelope.error.code).toBe("ERR_NOT_FOUND");
    expect(envelope.error.status).toBe(404);
    expect(envelope.error.message).toBe("Product not found");
    expect(envelope.error.details.id).toBe("sku-123");
    expect(envelope.error.timestamp).toBeDefined();
  });

  it("creates RateLimitError with retry_after_sec detail", () => {
    const err = new RateLimitError(30);
    expect(err.status).toBe(429);
    expect(err.details.retry_after_sec).toBe(30);
  });
});
