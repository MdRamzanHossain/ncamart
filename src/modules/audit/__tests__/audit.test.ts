import { describe, it, expect, beforeEach } from "vitest";
import {
  canonicalJson,
  computeAuditHash,
  recordAudit,
  verifyAuditChain,
  clearMemoryAuditChainForTesting,
  GENESIS_HASH,
} from "../service";

describe("audit service unit tests", () => {
  beforeEach(() => {
    clearMemoryAuditChainForTesting();
  });

  describe("canonicalJson", () => {
    it("sorts object keys alphabetically regardless of input insertion order", () => {
      const obj1 = { z: 1, a: 2, m: { b: 3, a: 4 } };
      const obj2 = { a: 2, m: { a: 4, b: 3 }, z: 1 };
      expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
      expect(canonicalJson(obj1)).toBe('{"a":2,"m":{"a":4,"b":3},"z":1}');
    });

    it("handles primitives, arrays, and null/undefined values correctly", () => {
      expect(canonicalJson(null)).toBe("null");
      expect(canonicalJson(undefined)).toBe("null");
      expect(canonicalJson("hello")).toBe('"hello"');
      expect(canonicalJson(123)).toBe("123");
      expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
    });
  });

  describe("hash chaining and verifyChain", () => {
    it("generates deterministic hash matching computeAuditHash", () => {
      const createdAt = new Date("2026-10-22T10:00:00.000Z");
      const hash1 = computeAuditHash(GENESIS_HASH, {
        staffId: null,
        actorType: "SYSTEM",
        action: "ORDER_CREATED",
        entityType: "ORDER",
        entityId: "ORD-2026-00001",
        beforeState: null,
        afterState: { totalPaisa: 5000 },
        ip: "127.0.0.1",
        userAgent: "NCAMart/1.0",
        requestId: "req-1",
        createdAt,
      });

      const hash2 = computeAuditHash(GENESIS_HASH, {
        staffId: null,
        actorType: "SYSTEM",
        action: "ORDER_CREATED",
        entityType: "ORDER",
        entityId: "ORD-2026-00001",
        beforeState: null,
        afterState: { totalPaisa: 5000 },
        ip: "127.0.0.1",
        userAgent: "NCAMart/1.0",
        requestId: "req-1",
        createdAt,
      });

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("records entries and builds an unbroken verified hash chain", async () => {
      for (let i = 1; i <= 50; i++) {
        await recordAudit(null, {
          actorType: "STAFF",
          action: `ACTION_${i}`,
          entityType: "PRODUCT",
          entityId: `PRD-${i}`,
          afterState: { index: i },
        });
      }

      const result = await verifyAuditChain({ useMemoryStore: true });
      expect(result.valid).toBe(true);
      expect(result.checkedCount).toBe(50);
      expect(result.tamperedRowId).toBeUndefined();
    });

    it("detects tampering when an audit entry payload is altered", async () => {
      for (let i = 1; i <= 5; i++) {
        await recordAudit(null, {
          actorType: "SYSTEM",
          action: `EVENT_${i}`,
          entityType: "ORDER",
          entityId: `ORD-${i}`,
          afterState: { step: i },
        });
      }

      // Verify chain is valid initially
      expect((await verifyAuditChain({ useMemoryStore: true })).valid).toBe(true);

      // Re-record with a tampered record
      clearMemoryAuditChainForTesting();
      await recordAudit(null, { actorType: "STAFF", action: "A1", entityType: "E", entityId: "1" });
      const r2 = await recordAudit(null, { actorType: "STAFF", action: "A2", entityType: "E", entityId: "2" });
      // Tamper row 2's action
      r2.action = "TAMPERED_ACTION";

      const check = await verifyAuditChain({ useMemoryStore: true });
      expect(check.valid).toBe(false);
      expect(check.tamperedRowId).toBe(r2.id);
      expect(check.error).toContain("Tampered row payload");
    });
  });
});
