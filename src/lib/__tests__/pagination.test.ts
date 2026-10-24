import { describe, it, expect } from "vitest";
import { parsePagination, buildPaginationMeta, toPaginatedResponse } from "../pagination";

describe("pagination.ts unit tests", () => {
  it("parses page and limit with defaults and computes offset", () => {
    const params = new URLSearchParams("page=2&limit=25");
    const parsed = parsePagination(params);

    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(25);
  });

  it("applies defaults (page 1, limit 20, max 100)", () => {
    const parsed = parsePagination(new URLSearchParams());
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
  });

  it("builds pagination meta and calculates total_pages", () => {
    const meta = buildPaginationMeta(45, 1, 20);
    expect(meta.total_count).toBe(45);
    expect(meta.total_pages).toBe(3);
    expect(meta.page).toBe(1);
    expect(meta.limit).toBe(20);
  });

  it("formats standard paginated response envelope", () => {
    const response = toPaginatedResponse(["item1", "item2"], 2, 1, 20);
    expect(response.items).toEqual(["item1", "item2"]);
    expect(response.pagination.total_count).toBe(2);
    expect(response.pagination.total_pages).toBe(1);
  });
});
