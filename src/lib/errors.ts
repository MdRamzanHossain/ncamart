/**
 * Error codes and typed application errors.
 *
 * Every non-2xx response is rendered from an AppError into the envelope:
 * {"error":{"code","message","status","details","timestamp"}}
 *
 * Add new codes to ERROR_CODES with their default HTTP status. Keep this list extensible.
 */

export const ERROR_CODES = {
  // 400
  ERR_VALIDATION: 400,
  ERR_INVALID_PHONE: 400,
  ERR_IDEMPOTENCY_KEY_REQUIRED: 400,
  ERR_INVALID_SIGNATURE_HASH: 400,
  // 401
  ERR_UNAUTHENTICATED: 401,
  ERR_STAFF_AUTH_FAILED: 401,
  ERR_OTP_INVALID: 401,
  ERR_INVALID_PIN: 401,
  // 403
  ERR_FORBIDDEN: 403,
  ERR_OWNERSHIP_UNCONFIRMED: 403,
  ERR_FOUR_EYES_VIOLATION: 403,
  ERR_IP_NOT_ALLOWED: 403,
  // 404
  ERR_NOT_FOUND: 404,
  // 409
  ERR_CONFLICT: 409,
  ERR_ILLEGAL_TRANSITION: 409,
  ERR_INSUFFICIENT_STOCK: 409,
  ERR_IDEMPOTENCY_IN_PROGRESS: 409,
  ERR_SLUG_ALREADY_EXISTS: 409,
  ERR_SKU_CODE_ALREADY_EXISTS: 409,
  // 410
  ERR_OTP_EXPIRED: 410,
  // 412
  ERR_BTRC_CLEARANCE_REQUIRED: 412,
  // 422
  ERR_BUSINESS_RULE: 422,
  ERR_MIXED_CART_DISALLOWED: 422,
  ERR_COD_NOT_ALLOWED: 422,
  ERR_CANCELLATION_DISALLOWED: 422,
  ERR_IDEMPOTENCY_MISMATCH: 422,
  ERR_ZERO_REPLICA_REQUIRED: 422,
  ERR_PRODUCT_IMMUTABLE: 422,
  ERR_CHECKLIST_FAILED: 422,
  ERR_UNBALANCED_JOURNAL_ENTRY: 422,
  // 423 is not in the P00 status map; locked PINs use 429 semantics ("too many attempts").
  ERR_PIN_LOCKED: 429,
  // 429
  ERR_RATE_LIMITED: 429,
  ERR_OTP_RATE_LIMIT: 429,
  // 500
  ERR_INTERNAL: 500,
  // 502
  ERR_GATEWAY_UNAVAILABLE: 502,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type ErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorDetails;

  constructor(code: ErrorCode, message: string, details: ErrorDetails = {}, status?: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status ?? ERROR_CODES[code];
    this.details = details;
  }
}

/** Business rule violation. Defaults to the code's mapped status (usually 422). */
export class BusinessError extends AppError {
  constructor(code: ErrorCode, message: string, details: ErrorDetails = {}, status?: number) {
    super(code, message, details, status);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Request validation failed", details: ErrorDetails = {}) {
    super("ERR_VALIDATION", message, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details: ErrorDetails = {}) {
    super("ERR_VALIDATION", message, details, 400);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required", details: ErrorDetails = {}) {
    super("ERR_UNAUTHENTICATED", message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action", details: ErrorDetails = {}) {
    super("ERR_FORBIDDEN", message, details);
  }
}

export class OwnershipUnconfirmedError extends AppError {
  constructor(
    message = "Phone ownership confirmation required before accessing personal data",
    details: ErrorDetails = {}
  ) {
    super("ERR_OWNERSHIP_UNCONFIRMED", message, details, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, details: ErrorDetails = {}) {
    super("ERR_NOT_FOUND", `${entity} not found`, details);
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode = "ERR_CONFLICT", message = "Conflict", details: ErrorDetails = {}) {
    super(code, message, details, 409);
  }
}

export class IllegalTransitionError extends AppError {
  constructor(entity: string, from: string, to: string) {
    super("ERR_ILLEGAL_TRANSITION", `Illegal ${entity} transition ${from} → ${to}`, { entity, from, to });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSec: number;
  constructor(retryAfterSec: number, code: ErrorCode = "ERR_RATE_LIMITED", message = "Too many requests") {
    super(code, message, { retry_after_sec: retryAfterSec }, 429);
    this.retryAfterSec = retryAfterSec;
  }
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    status: number;
    details: ErrorDetails;
    timestamp: string;
  };
}

export function toErrorEnvelope(err: AppError, now: Date = new Date()): ErrorEnvelope {
  return {
    error: {
      code: err.code,
      message: err.message,
      status: err.status,
      details: err.details,
      timestamp: now.toISOString(),
    },
  };
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
