import { sql, desc, asc, gte, lte, and } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { auditLogs, AuditLogRow } from "./schema";
import { AuditEntryInput, VerifyChainResult } from "./dto";

export const AUDIT_ADVISORY_LOCK_ID = 7429103;
export const GENESIS_HASH = "0".repeat(64);

// In-memory fallback store when running in mock mode or unit tests without database
const memAuditChain: AuditLogRow[] = [];
let memAuditIdCounter = 1n;

/**
 * Deterministic JSON stringifier that sorts object keys alphabetically.
 * Ensures consistent hash generation across environments.
 */
export function canonicalJson(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (val instanceof Date) return JSON.stringify(val.toISOString());
  if (typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) {
    return "[" + val.map(canonicalJson).join(",") + "]";
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return "{" + pairs.join(",") + "}";
}

/**
 * Compute the SHA-256 hash of an audit log entry given its predecessor's hash.
 */
export function computeAuditHash(
  prevHash: string,
  entry: {
    staffId: string | null;
    actorType: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeState: unknown;
    afterState: unknown;
    ip: string | null;
    userAgent: string | null;
    requestId: string | null;
    createdAt: Date | string;
  }
): string {
  const createdAtIso =
    entry.createdAt instanceof Date ? entry.createdAt.toISOString() : new Date(entry.createdAt).toISOString();

  const canonicalPayload = canonicalJson({
    action: entry.action,
    actorType: entry.actorType,
    afterState: entry.afterState ?? null,
    beforeState: entry.beforeState ?? null,
    createdAt: createdAtIso,
    entityId: entry.entityId,
    entityType: entry.entityType,
    ip: entry.ip ?? null,
    requestId: entry.requestId ?? null,
    staffId: entry.staffId ?? null,
    userAgent: entry.userAgent ?? null,
  });

  return sha256Hex(prevHash + canonicalPayload);
}

/**
 * Record a tamper-evident audit log entry within a database transaction.
 * Acquires pg_advisory_xact_lock to ensure serial insertion and unbroken hash chain.
 */
export async function recordAudit(
  tx: Tx | null | undefined,
  entry: AuditEntryInput
): Promise<AuditLogRow> {
  const createdAt = entry.createdAt ?? new Date();

  if (!tx) {
    // Memory fallback for mock/offline unit tests
    const prev = memAuditChain[memAuditChain.length - 1];
    const prevHash = prev ? prev.hash : GENESIS_HASH;
    const hash = computeAuditHash(prevHash, {
      staffId: entry.staffId ?? null,
      actorType: entry.actorType,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeState: entry.beforeState ?? null,
      afterState: entry.afterState ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      requestId: entry.requestId ?? null,
      createdAt,
    });

    const row: AuditLogRow = {
      id: memAuditIdCounter++,
      staffId: entry.staffId ?? null,
      actorType: entry.actorType,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeState: (entry.beforeState as Record<string, unknown>) ?? null,
      afterState: (entry.afterState as Record<string, unknown>) ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      requestId: entry.requestId ?? null,
      createdAt,
      prevHash,
      hash,
    };
    memAuditChain.push(row);
    return row;
  }

  // Acquire transaction advisory lock to prevent race conditions in hash chain ordering
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${AUDIT_ADVISORY_LOCK_ID})`);

  // Fetch the most recent audit row to get prev_hash
  const latestRows = await tx
    .select({ hash: auditLogs.hash })
    .from(auditLogs)
    .orderBy(desc(auditLogs.id))
    .limit(1);

  const prevHash = latestRows[0]?.hash ?? GENESIS_HASH;

  const hash = computeAuditHash(prevHash, {
    staffId: entry.staffId ?? null,
    actorType: entry.actorType,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeState: entry.beforeState ?? null,
    afterState: entry.afterState ?? null,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
    requestId: entry.requestId ?? null,
    createdAt,
  });

  const [inserted] = await tx
    .insert(auditLogs)
    .values({
      staffId: entry.staffId ?? null,
      actorType: entry.actorType,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeState: entry.beforeState ?? null,
      afterState: entry.afterState ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      requestId: entry.requestId ?? null,
      createdAt,
      prevHash,
      hash,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to insert audit log entry");
  }

  return inserted;
}

/**
 * Verify cryptographic hash chain integrity between optional ID bounds.
 * Detects any tampered, deleted, or out-of-order records.
 */
export async function verifyAuditChain(
  options: {
    fromId?: bigint;
    toId?: bigint;
    tx?: Tx;
    useMemoryStore?: boolean;
  } = {}
): Promise<VerifyChainResult> {
  if (options.useMemoryStore || (!options.tx && memAuditChain.length > 0)) {
    let checkedCount = 0;
    let expectedPrevHash = GENESIS_HASH;

    for (const row of memAuditChain) {
      if (options.fromId && row.id < options.fromId) continue;
      if (options.toId && row.id > options.toId) break;

      if (checkedCount === 0 && (!options.fromId || row.id === 1n)) {
        if (row.prevHash !== GENESIS_HASH) {
          return {
            valid: false,
            checkedCount,
            tamperedRowId: row.id,
            error: "Genesis row has invalid prevHash",
          };
        }
      } else if (row.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          checkedCount,
          tamperedRowId: row.id,
          error: `Broken hash chain: expected prevHash ${expectedPrevHash}, found ${row.prevHash}`,
        };
      }

      const calculated = computeAuditHash(row.prevHash, row);
      if (calculated !== row.hash) {
        return {
          valid: false,
          checkedCount,
          tamperedRowId: row.id,
          error: `Tampered row payload: hash mismatch at row ${row.id}`,
        };
      }

      expectedPrevHash = row.hash;
      checkedCount++;
    }

    return { valid: true, checkedCount };
  }

  const client = options.tx ?? defaultDb;
  const conditions = [];
  if (options.fromId) conditions.push(gte(auditLogs.id, options.fromId));
  if (options.toId) conditions.push(lte(auditLogs.id, options.toId));

  const rows = await client
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(auditLogs.id));

  let checkedCount = 0;
  let expectedPrevHash: string | null = null;

  for (const row of rows) {
    if (expectedPrevHash === null) {
      expectedPrevHash = row.prevHash;
    } else if (row.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        checkedCount,
        tamperedRowId: row.id,
        error: `Broken hash chain: expected prevHash ${expectedPrevHash}, found ${row.prevHash}`,
      };
    }

    const calculated = computeAuditHash(row.prevHash, row);
    if (calculated !== row.hash) {
      return {
        valid: false,
        checkedCount,
        tamperedRowId: row.id,
        error: `Tampered row payload: hash mismatch at row ${row.id}`,
      };
    }

    expectedPrevHash = row.hash;
    checkedCount++;
  }

  return { valid: true, checkedCount };
}

export function getRecentMemoryAuditEntries(): AuditLogRow[] {
  return [...memAuditChain];
}

export function clearMemoryAuditChainForTesting(): void {
  memAuditChain.length = 0;
  memAuditIdCounter = 1n;
}

export const auditService = {
  record: recordAudit,
  verify: verifyAuditChain,
};
