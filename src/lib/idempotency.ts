import { pool } from "./db";
import { BusinessError, ConflictError } from "./errors";
import { logger } from "./logger";

export type IdempotencyAction =
  | { action: "proceed" }
  | { action: "replay"; status: number; body: unknown };

// In-memory fallback if the DB table isn't migrated yet
interface InMemoryIdempotencyEntry {
  scope: string;
  requestHash: string;
  responseStatus?: number;
  responseBody?: unknown;
  lockedAt: number;
  expiresAt: number;
}
const memStore = new Map<string, InMemoryIdempotencyEntry>();

export async function beginIdempotency(
  key: string,
  scope: string,
  requestHash: string
): Promise<IdempotencyAction> {
  const storeKey = `${scope}:${key}`;
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours TTL

  try {
    const client = await pool.connect();
    try {
      // 1. Try to insert record with locked_at = now()
      const insertQuery = `
        INSERT INTO idempotency_keys (key, scope, request_hash, locked_at, created_at, expires_at)
        VALUES ($1, $2, $3, NOW(), NOW(), NOW() + INTERVAL '24 hours')
        ON CONFLICT (key, scope) DO NOTHING
        RETURNING key;
      `;
      const insertResult = await client.query(insertQuery, [key, scope, requestHash]);

      if (insertResult.rowCount && insertResult.rowCount > 0) {
        return { action: "proceed" };
      }

      // 2. Already exists: query with row lock to check state
      const selectQuery = `
        SELECT request_hash, response_status, response_body, locked_at, expires_at
        FROM idempotency_keys
        WHERE key = $1 AND scope = $2
        FOR UPDATE;
      `;
      const selectResult = await client.query(selectQuery, [key, scope]);

      if (selectResult.rowCount === 0) {
        return { action: "proceed" };
      }

      const row = selectResult.rows[0];

      // Mismatch check
      if (row.request_hash !== requestHash) {
        throw new BusinessError(
          "ERR_IDEMPOTENCY_MISMATCH",
          "Idempotency key reused with different request payload",
          { key, scope }
        );
      }

      // Replay if completed
      if (row.response_status !== null && row.response_status !== undefined) {
        return {
          action: "replay",
          status: row.response_status,
          body: row.response_body,
        };
      }

      // Still in progress
      throw new ConflictError(
        "ERR_IDEMPOTENCY_IN_PROGRESS",
        "A request with this Idempotency-Key is currently in progress",
        { key, scope }
      );
    } finally {
      client.release();
    }
  } catch (err) {
    if (err instanceof BusinessError || err instanceof ConflictError) {
      throw err;
    }

    // In-memory fallback if table does not exist yet (pre-P03)
    logger.debug({ err }, "Using in-memory idempotency fallback");
    const existing = memStore.get(storeKey);
    if (!existing || now > existing.expiresAt) {
      memStore.set(storeKey, {
        scope,
        requestHash,
        lockedAt: now,
        expiresAt,
      });
      return { action: "proceed" };
    }

    if (existing.requestHash !== requestHash) {
      throw new BusinessError(
        "ERR_IDEMPOTENCY_MISMATCH",
        "Idempotency key reused with different request payload",
        { key, scope }
      );
    }

    if (existing.responseStatus !== undefined) {
      return {
        action: "replay",
        status: existing.responseStatus,
        body: existing.responseBody,
      };
    }

    throw new ConflictError(
      "ERR_IDEMPOTENCY_IN_PROGRESS",
      "A request with this Idempotency-Key is currently in progress",
      { key, scope }
    );
  }
}

export async function completeIdempotency(
  key: string,
  scope: string,
  responseStatus: number,
  responseBody: unknown
): Promise<void> {
  const storeKey = `${scope}:${key}`;

  try {
    const client = await pool.connect();
    try {
      const updateQuery = `
        UPDATE idempotency_keys
        SET response_status = $3,
            response_body = $4,
            locked_at = NULL
        WHERE key = $1 AND scope = $2;
      `;
      await client.query(updateQuery, [key, scope, responseStatus, JSON.stringify(responseBody)]);
    } finally {
      client.release();
    }
  } catch {
    // In-memory fallback
    const entry = memStore.get(storeKey);
    if (entry) {
      entry.responseStatus = responseStatus;
      entry.responseBody = responseBody;
    }
  }
}
