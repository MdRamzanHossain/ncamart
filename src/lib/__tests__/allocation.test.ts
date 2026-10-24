import { describe, it, expect } from "vitest";
import { largestRemainderAllocate } from "../allocation";
import { assertPaisa } from "../money";

describe("allocation.ts unit tests", () => {
  it("allocates coupon discount pro-rata ensuring exact sum", () => {
    // Total discount 100 paisa across 3 items with prices [1000, 2000, 3000] (weights 1:2:3)
    const totalDiscount = assertPaisa(100);
    const weights = [1000, 2000, 3000];

    const allocated = largestRemainderAllocate(totalDiscount, weights);

    // Sum must equal exactly 100
    const sum = allocated.reduce((acc, v) => acc + v, 0);
    expect(sum).toBe(100);

    // Exact split: 100 * 1/6 = 16.666, 100 * 2/6 = 33.333, 100 * 3/6 = 50.0
    // Remainder 1 goes to index 0 (0.666) -> [17, 33, 50]
    expect(allocated).toEqual([17, 33, 50]);
  });

  it("handles remainder tie-breaking deterministically by index", () => {
    // Total 10 across 4 equal items (weights [1, 1, 1, 1])
    // Base 2 each (sum 8), 2 remainder units go to first two indices [0, 1]
    const allocated = largestRemainderAllocate(assertPaisa(10), [1, 1, 1, 1]);
    expect(allocated).toEqual([3, 3, 2, 2]);
    expect(allocated.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("handles zero total allocation", () => {
    const allocated = largestRemainderAllocate(assertPaisa(0), [10, 20, 30]);
    expect(allocated).toEqual([0, 0, 0]);
  });

  it("handles zero weights on some items", () => {
    const allocated = largestRemainderAllocate(assertPaisa(100), [0, 50, 50]);
    expect(allocated).toEqual([0, 50, 50]);
  });
});
