import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiClientError } from "../client";

describe("F03 — API Client & RFC 7807 Layer", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("performs GET request and parses JSON data", async () => {
    const mockData = { categories: [{ id: "cat-1", name: "Engineering Tools" }] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockData,
    } as Response);

    const result = await api.get<{ categories: Array<{ id: string; name: string }> }>("/api/v1/catalog/categories");
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/catalog/categories",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      })
    );
  });

  it("auto-attaches Idempotency-Key on POST mutating request", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true }),
    } as Response);

    await api.post("/api/v1/orders/checkout", { items: [] });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/orders/checkout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "Idempotency-Key": expect.any(String),
        }),
      })
    );
  });

  it("translates RFC 7807 problem details to ApiClientError with Bangla message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        error: {
          code: "ERR_MIXED_CART_DISALLOWED",
          message: "Mixed pre-order and in-stock items disallowed",
        },
      }),
    } as Response);

    await expect(api.get("/api/v1/cart")).rejects.toThrow(ApiClientError);

    try {
      await api.get("/api/v1/cart");
    } catch (e) {
      const apiErr = e as ApiClientError;
      expect(apiErr.code).toBe("ERR_MIXED_CART_DISALLOWED");
      expect(apiErr.status).toBe(422);
      expect(apiErr.messageBn).toContain("প্রি-অর্ডার এবং ইন-স্টক পণ্য একসাথে চেকআউট করা সম্ভব নয়");
    }
  });
});
