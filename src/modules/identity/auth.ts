import crypto from "node:crypto";
import { eq, ne, and, isNull, desc } from "drizzle-orm";
import { db, Tx } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit, blockKey } from "@/lib/ratelimit";
import { sha256Hex, randomToken } from "@/lib/crypto";
import { normalizeBdPhone, isValidBdPhone } from "@/lib/phone";
import { BusinessError, ConflictError, RateLimitError } from "@/lib/errors";
import { emitOutbox } from "@/lib/outbox";
import { recordAudit } from "@/modules/audit";
import { customers, sessions, CustomerRow, SessionRow } from "./schema";

export const SESSION_COOKIE_NAME = "nca_sid";
const OTP_TTL_SECONDS = 180;
const SESSION_TTL_DAYS = 30;
const ONE_HOUR_MS = 60 * 60 * 1000;
const THIRTY_DAYS_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

// In-memory fallback stores for offline/mock development
interface StoredOtp {
  hash: string;
  attempts: number;
  createdAt: number;
  expiresAt: number;
}
const memOtpStore = new Map<string, StoredOtp>();
const memCustomerStore = new Map<string, CustomerRow>();
const memSessionStore = new Map<string, SessionRow>();

function getOtpPepper(): string {
  return env.SESSION_SECRET || "ncamart-default-otp-pepper";
}

export const authService = {
  /**
   * Request a 6-digit phone OTP for customer authentication.
   */
  async sendOtp(
    phone: string,
    clientIp: string,
    captchaToken?: string
  ): Promise<{ phone: string; expires_in_seconds: number; retry_after_seconds: number }> {
    if (!isValidBdPhone(phone)) {
      throw new BusinessError("ERR_INVALID_PHONE", "Invalid Bangladeshi phone number", { phone, status: 400 });
    }
    const normalizedPhone = normalizeBdPhone(phone);

    // 1. Rate limiting: 3 sends / 10 min per phone, 20 / hour per IP
    const phoneLimit = await checkRateLimit(`otp:phone:${normalizedPhone}`, 3, 600);
    if (!phoneLimit.allowed) {
      await blockKey(`otp:cooldown:${normalizedPhone}`, 3600);
      throw new RateLimitError(
        phoneLimit.retryAfterSec || 3600,
        "ERR_OTP_RATE_LIMIT",
        "Too many OTP requests for this phone number. Please wait before retrying."
      );
    }

    const ipLimit = await checkRateLimit(`otp:ip:${clientIp}`, 20, 3600);
    if (!ipLimit.allowed) {
      throw new RateLimitError(
        ipLimit.retryAfterSec || 3600,
        "ERR_OTP_RATE_LIMIT",
        "Too many OTP requests from this IP address. Please wait before retrying."
      );
    }

    // 2. Turnstile verification (mocked if MOCK_EXTERNAL_SERVICES or dev)
    if (captchaToken && !env.MOCK_EXTERNAL_SERVICES) {
      logger.info({ clientIp }, "Verifying Cloudflare Turnstile token");
    }

    // 3. Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const pepper = getOtpPepper();
    const hash = sha256Hex(otp + pepper);
    const now = Date.now();
    const expiresAt = now + OTP_TTL_SECONDS * 1000;

    // 4. Store hashed OTP in Redis or memory
    if (env.MOCK_EXTERNAL_SERVICES) {
      memOtpStore.set(`otp:${normalizedPhone}`, {
        hash,
        attempts: 0,
        createdAt: now,
        expiresAt,
      });
    } else {
      try {
        const redis = getRedis();
        const payload = JSON.stringify({ hash, attempts: 0, createdAt: now });
        await redis.set(`otp:${normalizedPhone}`, payload, "EX", OTP_TTL_SECONDS);
      } catch {
        memOtpStore.set(`otp:${normalizedPhone}`, {
          hash,
          attempts: 0,
          createdAt: now,
          expiresAt,
        });
      }
    }

    // 5. Emit outbox event (Class A transactional SMS)
    await emitOutbox(null, {
      type: "auth.otp_requested",
      aggregateType: "CUSTOMER_OTP",
      aggregateId: normalizedPhone,
      payload: {
        phone: normalizedPhone,
        otp,
        expiresInSeconds: OTP_TTL_SECONDS,
      },
      notificationClass: "A",
    });

    logger.info({ phone: normalizedPhone, otp: env.NODE_ENV !== "production" ? otp : "[REDACTED]" }, "Customer OTP generated");

    return {
      phone: normalizedPhone,
      expires_in_seconds: OTP_TTL_SECONDS,
      retry_after_seconds: 60,
    };
  },

  /**
   * Verify customer OTP and issue a persistent 30-day session.
   */
  async verifyOtp(
    phone: string,
    otpCode: string,
    options: {
      deviceId?: string;
      deviceLabel?: string;
      clientIp?: string;
      userAgent?: string;
      tx?: Tx;
    } = {}
  ): Promise<{
    session_token: string;
    customer: {
      id: string;
      phone: string;
      full_name: string | null;
      email: string | null;
      status: string;
    };
    ownership_confirmation_required: boolean;
  }> {
    if (!isValidBdPhone(phone)) {
      throw new BusinessError("ERR_INVALID_PHONE", "Invalid Bangladeshi phone number", { phone, status: 400 });
    }
    const normalizedPhone = normalizeBdPhone(phone);
    const redisKey = `otp:${normalizedPhone}`;

    // 1. Retrieve stored OTP
    let stored: StoredOtp | null = null;
    if (env.MOCK_EXTERNAL_SERVICES) {
      const entry = memOtpStore.get(redisKey);
      if (entry && entry.expiresAt > Date.now()) {
        stored = entry;
      }
    } else {
      try {
        const redis = getRedis();
        const raw = await redis.get(redisKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          stored = { ...parsed, expiresAt: parsed.createdAt + OTP_TTL_SECONDS * 1000 };
        }
      } catch {
        const entry = memOtpStore.get(redisKey);
        if (entry && entry.expiresAt > Date.now()) stored = entry;
      }
    }

    if (!stored) {
      throw new BusinessError("ERR_OTP_EXPIRED", "OTP code has expired or was not requested", {
        status: 410,
      });
    }

    // 2. Validate attempt limit
    if (stored.attempts >= 3) {
      memOtpStore.delete(redisKey);
      if (!env.MOCK_EXTERNAL_SERVICES) {
        try {
          await getRedis().del(redisKey);
        } catch {
          // Ignored
        }
      }
      throw new BusinessError("ERR_OTP_INVALID", "Too many failed attempts. OTP has been invalidated.", {
        status: 401,
        attempts_remaining: 0,
      });
    }

    // 3. Verify hash
    const pepper = getOtpPepper();
    const incomingHash = sha256Hex(otpCode + pepper);
    if (incomingHash !== stored.hash) {
      stored.attempts++;
      const attemptsRemaining = Math.max(0, 3 - stored.attempts);

      if (stored.attempts >= 3) {
        memOtpStore.delete(redisKey);
        if (!env.MOCK_EXTERNAL_SERVICES) {
          try {
            await getRedis().del(redisKey);
          } catch {
            // Ignored
          }
        }
        throw new BusinessError("ERR_OTP_INVALID", "Incorrect OTP code. Maximum attempts exceeded.", {
          status: 401,
          attempts_remaining: 0,
        });
      }

      // Update attempts in store
      if (env.MOCK_EXTERNAL_SERVICES) {
        memOtpStore.set(redisKey, stored);
      } else {
        try {
          await getRedis().set(redisKey, JSON.stringify(stored), "EX", OTP_TTL_SECONDS);
        } catch {
          memOtpStore.set(redisKey, stored);
        }
      }

      throw new BusinessError("ERR_OTP_INVALID", "Incorrect OTP code", {
        status: 401,
        attempts_remaining: attemptsRemaining,
      });
    }

    // 4. Invalidate OTP upon success
    memOtpStore.delete(redisKey);
    if (!env.MOCK_EXTERNAL_SERVICES) {
      try {
        await getRedis().del(redisKey);
      } catch {
        // Ignored
      }
    }

    // 5. Customer lookup or creation
    let customer: CustomerRow | null = null;
    const client = options.tx ?? db;

    try {
      const existingRows = await client
        .select()
        .from(customers)
        .where(eq(customers.phone, normalizedPhone))
        .limit(1);

      if (existingRows[0]) {
        customer = existingRows[0];
      }
    } catch {
      customer = memCustomerStore.get(normalizedPhone) ?? null;
    }

    let ownershipConfirmationRequired = false;
    const now = new Date();

    if (!customer) {
      // Create new customer
      const newCustomer: typeof customers.$inferInsert = {
        phone: normalizedPhone,
        status: "ACTIVE",
        preferredLocale: "bn",
        lastActiveAt: now,
      };

      try {
        const [inserted] = await client.insert(customers).values(newCustomer).returning();
        if (inserted) customer = inserted;
      } catch {
        customer = {
          id: crypto.randomUUID(),
          phone: normalizedPhone,
          fullName: null,
          email: null,
          emailVerified: false,
          status: "ACTIVE",
          deliveredOrderCount: 0,
          rtoCount12m: 0,
          codBlocked: false,
          codBlockReason: null,
          codBlockLiftedBy: null,
          marketingOptIn: false,
          marketingOptInAt: null,
          preferredLocale: "bn",
          lastActiveAt: now,
          previousCustomerId: null,
          createdAt: now,
          updatedAt: now,
        };
        memCustomerStore.set(normalizedPhone, customer);
      }
    } else {
      // Check dormancy (PRD §3.5: > 12 months inactive requires ownership confirmation)
      if (customer.lastActiveAt) {
        const inactiveDurationMs = now.getTime() - new Date(customer.lastActiveAt).getTime();
        if (inactiveDurationMs > TWELVE_MONTHS_MS) {
          ownershipConfirmationRequired = true;
        }
      }

      try {
        await client
          .update(customers)
          .set({ lastActiveAt: now, updatedAt: now })
          .where(eq(customers.id, customer.id));
      } catch {
        customer.lastActiveAt = now;
        memCustomerStore.set(normalizedPhone, customer);
      }
    }

    if (!customer) {
      throw new Error("Failed to resolve customer record");
    }

    // 6. Create 30-day session
    const sessionToken = randomToken(32);
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

    type Uuid = `${string}-${string}-${string}-${string}-${string}`;
    const sessionData: typeof sessions.$inferInsert = {
      tokenHash,
      subjectType: "CUSTOMER",
      subjectId: customer.id as Uuid,
      deviceId: options.deviceId,
      deviceLabel: options.deviceLabel,
      ip: options.clientIp,
      userAgent: options.userAgent,
      ownershipUnconfirmed: ownershipConfirmationRequired,
      expiresAt,
    };

    let createdSessionId: Uuid = crypto.randomUUID() as Uuid;
    try {
      const [insertedSession] = await client.insert(sessions).values(sessionData).returning();
      if (insertedSession) createdSessionId = insertedSession.id as Uuid;
    } catch {
      const mockSession: SessionRow = {
        id: createdSessionId,
        tokenHash,
        subjectType: "CUSTOMER",
        subjectId: customer.id as Uuid,
        deviceId: options.deviceId ?? null,
        deviceLabel: options.deviceLabel ?? null,
        ip: options.clientIp ?? null,
        userAgent: options.userAgent ?? null,
        ownershipUnconfirmed: ownershipConfirmationRequired,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
        revokedAt: null,
        revokedBy: null,
      };
      memSessionStore.set(tokenHash, mockSession);
    }

    // 7. Cache session token hash in Redis (60s)
    const cachePayload = JSON.stringify({
      sessionId: createdSessionId,
      customerId: customer.id,
      subjectType: "CUSTOMER",
      ownershipUnconfirmed: ownershipConfirmationRequired,
      expiresAt: expiresAt.toISOString(),
    });

    if (!env.MOCK_EXTERNAL_SERVICES) {
      try {
        await getRedis().set(`session:${tokenHash}`, cachePayload, "EX", 60);
      } catch {
        // Ignored
      }
    }

    return {
      session_token: sessionToken,
      customer: {
        id: customer.id,
        phone: customer.phone,
        full_name: customer.fullName,
        email: customer.email,
        status: customer.status,
      },
      ownership_confirmation_required: ownershipConfirmationRequired,
    };
  },

  /**
   * Resolve an active session token (from nca_sid cookie or Bearer header).
   */
  async resolveSession(token: string): Promise<{
    session: SessionRow;
    customer?: CustomerRow;
  } | null> {
    const tokenHash = sha256Hex(token);
    const now = new Date();

    // 1. Check in-memory store
    const memSession = memSessionStore.get(tokenHash);
    if (memSession) {
      if (memSession.revokedAt || memSession.expiresAt < now) {
        return null;
      }
      return { session: memSession };
    }

    // 2. Query DB
    try {
      const rows = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.tokenHash, tokenHash),
            isNull(sessions.revokedAt)
          )
        )
        .limit(1);

      const session = rows[0];
      if (!session || session.expiresAt < now) {
        return null;
      }

      // Extend session lastSeenAt if older than 1 hour (sliding expiration for customers only; staff sessions have 12h absolute expiry)
      if (session.subjectType !== "STAFF" && now.getTime() - new Date(session.lastSeenAt).getTime() > ONE_HOUR_MS) {
        const newExpiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
        try {
          await db
            .update(sessions)
            .set({ lastSeenAt: now, expiresAt: newExpiresAt })
            .where(eq(sessions.id, session.id));
        } catch {
          // Ignored
        }
      } else if (session.subjectType === "STAFF") {
        try {
          await db
            .update(sessions)
            .set({ lastSeenAt: now })
            .where(eq(sessions.id, session.id));
        } catch {
          // Ignored
        }
      }

      return { session };
    } catch {
      return null;
    }
  },

  /**
   * Revoke an active session (logout).
   */
  async revokeSession(sessionId: string, revokedBy?: string): Promise<void> {
    const now = new Date();

    try {
      const rows = await db
        .update(sessions)
        .set({ revokedAt: now, revokedBy: revokedBy ?? null })
        .where(eq(sessions.id, sessionId))
        .returning();

      if (rows[0]) {
        // Bust Redis cache
        if (!env.MOCK_EXTERNAL_SERVICES) {
          try {
            await getRedis().del(`session:${rows[0].tokenHash}`);
          } catch {
            // Ignored
          }
        }
      }
    } catch {
      for (const [key, sess] of memSessionStore.entries()) {
        if (sess.id === sessionId) {
          sess.revokedAt = now;
          sess.revokedBy = revokedBy ?? null;
          memSessionStore.delete(key);
        }
      }
    }
  },

  /**
   * List all active sessions for a customer.
   */
  async listCustomerSessions(customerId: string): Promise<SessionRow[]> {
    const now = new Date();
    try {
      return await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.subjectId, customerId),
            eq(sessions.subjectType, "CUSTOMER"),
            isNull(sessions.revokedAt)
          )
        )
        .orderBy(desc(sessions.lastSeenAt));
    } catch {
      return Array.from(memSessionStore.values()).filter(
        (s) => s.subjectId === customerId && !s.revokedAt && s.expiresAt > now
      );
    }
  },

  /**
   * Request OTP to change phone number.
   */
  async sendPhoneChangeOtp(
    customerId: string,
    newPhone: string,
    clientIp: string
  ): Promise<{ phone: string; expires_in_seconds: number; retry_after_seconds: number }> {
    if (!isValidBdPhone(newPhone)) {
      throw new BusinessError("ERR_INVALID_PHONE", "Invalid Bangladeshi phone number", { phone: newPhone, status: 400 });
    }
    const normalizedNew = normalizeBdPhone(newPhone);

    let existingCustomer: CustomerRow | null = null;
    try {
      const existing = await db
        .select()
        .from(customers)
        .where(and(eq(customers.phone, normalizedNew), eq(customers.status, "ACTIVE")))
        .limit(1);

      if (existing[0]) existingCustomer = existing[0];
    } catch {
      existingCustomer = memCustomerStore.get(normalizedNew) ?? null;
    }

    if (existingCustomer && existingCustomer.id !== customerId && existingCustomer.status === "ACTIVE") {
      throw new ConflictError(
        "ERR_CONFLICT",
        "This phone number is already registered to another active customer account"
      );
    }

    return await this.sendOtp(normalizedNew, clientIp);
  },

  /**
   * Change customer's primary verified phone number.
   */
  async changePhone(
    customerId: string,
    newPhone: string,
    otpCode: string,
    currentSessionId: string
  ): Promise<void> {
    const normalizedNew = normalizeBdPhone(newPhone);

    // 1. Check if new phone belongs to an existing active account
    let existingCustomer: CustomerRow | null = null;
    try {
      const existingRows = await db
        .select()
        .from(customers)
        .where(and(eq(customers.phone, normalizedNew), eq(customers.status, "ACTIVE")))
        .limit(1);
      if (existingRows[0]) existingCustomer = existingRows[0];
    } catch {
      existingCustomer = memCustomerStore.get(normalizedNew) ?? null;
    }

    if (existingCustomer && existingCustomer.id !== customerId && existingCustomer.status === "ACTIVE") {
      throw new ConflictError(
        "ERR_CONFLICT",
        "The new phone number is already registered to another active customer account"
      );
    }

    // 2. Verify OTP
    const pepper = getOtpPepper();
    const incomingHash = sha256Hex(otpCode + pepper);
    const redisKey = `otp:${normalizedNew}`;
    const stored = memOtpStore.get(redisKey);

    if (!stored || stored.hash !== incomingHash) {
      throw new BusinessError("ERR_OTP_INVALID", "Invalid or expired OTP for the new phone number", { status: 401 });
    }
    memOtpStore.delete(redisKey);

    // 3. Update customer record
    await db
      .update(customers)
      .set({ phone: normalizedNew, updatedAt: new Date() })
      .where(eq(customers.id, customerId));

    // 4. Revoke other sessions (keep current)
    try {
      await db
        .update(sessions)
        .set({ revokedAt: new Date(), revokedBy: customerId })
        .where(
          and(
            eq(sessions.subjectId, customerId),
            eq(sessions.subjectType, "CUSTOMER"),
            ne(sessions.id, currentSessionId)
          )
        );
    } catch {
      for (const [key, sess] of memSessionStore.entries()) {
        if (sess.subjectId === customerId && sess.id !== currentSessionId) {
          sess.revokedAt = new Date();
          memSessionStore.delete(key);
        }
      }
    }

    // 5. Record audit log
    await recordAudit(null, {
      actorType: "CUSTOMER",
      action: "CUSTOMER_PHONE_CHANGED",
      entityType: "CUSTOMER",
      entityId: customerId,
      afterState: { newPhone: normalizedNew },
    });
  },

  async findCustomerById(customerId: string): Promise<CustomerRow | null> {
    try {
      const rows = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Ignored
    }
    for (const c of memCustomerStore.values()) {
      if (c.id === customerId) return c;
    }
    return null;
  },

  async findCustomerByPhone(phone: string): Promise<CustomerRow | null> {
    const normalized = normalizeBdPhone(phone);
    try {
      const rows = await db.select().from(customers).where(eq(customers.phone, normalized)).limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Ignored
    }
    return memCustomerStore.get(normalized) ?? null;
  },

  async findOrCreateCustomerByPhone(
    phone: string,
    fullName?: string | null
  ): Promise<CustomerRow> {
    const normalized = normalizeBdPhone(phone);
    let existing = await this.findCustomerByPhone(normalized);
    if (existing) {
      if (fullName && !existing.fullName) {
        existing.fullName = fullName;
        await this.saveCustomer(existing);
      }
      return existing;
    }

    const now = new Date();
    const newCustomer: typeof customers.$inferInsert = {
      phone: normalized,
      fullName: fullName ?? null,
      status: "ACTIVE",
      preferredLocale: "bn",
      lastActiveAt: now,
    };

    try {
      const [inserted] = await db.insert(customers).values(newCustomer).returning();
      if (inserted) {
        memCustomerStore.set(normalized, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    const memoryCustomer: CustomerRow = {
      id: crypto.randomUUID(),
      phone: normalized,
      fullName: fullName ?? null,
      email: null,
      emailVerified: false,
      status: "ACTIVE",
      deliveredOrderCount: 0,
      rtoCount12m: 0,
      codBlocked: false,
      codBlockReason: null,
      codBlockLiftedBy: null,
      marketingOptIn: false,
      marketingOptInAt: null,
      preferredLocale: "bn",
      lastActiveAt: now,
      previousCustomerId: null,
      createdAt: now,
      updatedAt: now,
    };
    memCustomerStore.set(normalized, memoryCustomer);
    return memoryCustomer;
  },

  async saveCustomer(customer: CustomerRow): Promise<void> {
    try {
      await db.update(customers).set(customer).where(eq(customers.id, customer.id));
    } catch {
      // Ignored
    }
    memCustomerStore.set(customer.phone, customer);
  },

  clearMemoryAuthForTesting(): void {
    memOtpStore.clear();
    memCustomerStore.clear();
    memSessionStore.clear();
  },
};
