import { describe, it, expect, beforeEach } from "vitest";
import {
  nextNumber,
  generateOrderNumber,
  generateRmaNumber,
  generateRunnerNumber,
  generateRefundNumber,
  generateJournalNumber,
  generateMushakNumber,
  clearMemoryCountersForTesting,
} from "../counters";

describe("gapless number counters & formatters unit tests", () => {
  beforeEach(() => {
    clearMemoryCountersForTesting();
  });

  it("advances counters gaplessly and independently across scopes", async () => {
    const ord1 = await nextNumber(null, "ORDER", "2026");
    const ord2 = await nextNumber(null, "ORDER", "2026");
    const rma1 = await nextNumber(null, "RMA", "2026");
    const ord3 = await nextNumber(null, "ORDER", "2026");

    expect(ord1).toBe(1n);
    expect(ord2).toBe(2n);
    expect(rma1).toBe(1n);
    expect(ord3).toBe(3n);
  });

  it("handles 100 concurrent counter increments without duplicate or skipped numbers", async () => {
    const promises = Array.from({ length: 100 }, () => nextNumber(null, "CONCURRENT_TEST", "2026"));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(100);
    const sorted = results.map((n) => Number(n)).sort((a, b) => a - b);
    for (let i = 0; i < 100; i++) {
      expect(sorted[i]).toBe(i + 1);
    }
  });

  it("formats human-readable IDs accurately according to NCAMart conventions", async () => {
    const testDate = new Date("2026-10-22T08:00:00.000Z");

    const orderId = await generateOrderNumber(null, testDate);
    expect(orderId).toBe("ORD-2026-00001");

    const orderId2 = await generateOrderNumber(null, testDate);
    expect(orderId2).toBe("ORD-2026-00002");

    const rmaId = await generateRmaNumber(null, testDate);
    expect(rmaId).toBe("RMA-2026-0001");

    const runnerId = await generateRunnerNumber(null, testDate);
    expect(runnerId).toBe("RUN-20261022-0001");

    const refundId = await generateRefundNumber(null, testDate);
    expect(refundId).toBe("REF-2026-00001");

    const journalId = await generateJournalNumber(null, testDate);
    expect(journalId).toBe("JRN-20261022-00001");

    const mushakId = await generateMushakNumber(null, testDate);
    // Fiscal year of 2026-10-22 is 2026-2027
    expect(mushakId).toBe("MUSHAK-6.3-2026-2027-000001");
  });
});
