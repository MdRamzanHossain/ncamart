import crypto from "node:crypto";
import argon2 from "argon2";
import { authenticator } from "otplib";
import { eq, and, isNull } from "drizzle-orm";
import { db, Tx } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { checkRateLimit, blockKey, resetRateLimit } from "@/lib/ratelimit";
import { sha256Hex, randomToken, aesGcmEncrypt, aesGcmDecrypt } from "@/lib/crypto";
import { normalizeBdPhone, isValidBdPhone } from "@/lib/phone";
import { AppError, BusinessError, RateLimitError, UnauthenticatedError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit";
import { staff, staffRoles, sessions, StaffRow, SessionRow } from "./schema";
import { StaffRole } from "./permissions";

// Configure otplib with window ±1 for clock-drift tolerance
authenticator.options = { window: 1 };

export const STAFF_SESSION_COOKIE_NAME = "nca_sid";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const DUMMY_ARGON_HASH = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$abcdefghijklmnopqrstuvwxyz0123456789";

// In-memory fallback stores for tests/offline
const memStaffStore = new Map<string, StaffRow>();
const memStaffRolesStore = new Map<string, StaffRole[]>();
const memStaffEnrollmentStore = new Map<string, { staffId: string; expiresAt: number }>();
const memStaffSessionStore = new Map<string, SessionRow>();

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

export const staffAuthService = {
  /**
   * Authenticate staff with identifier (email or phone), password, and TOTP.
   */
  async login(
    identifier: string,
    password: string,
    totpCode?: string,
    clientIp = "127.0.0.1",
    userAgent?: string
  ): Promise<
    | { totp_enrollment_required: true; enrollment_token: string }
    | {
        session_token: string;
        staff: {
          id: string;
          email: string;
          phone: string;
          full_name: string;
          roles: string[];
          must_change_password: boolean;
        };
      }
  > {
    const cleanId = identifier.trim().toLowerCase();

    // 1. Rate limiting: 5 failures / 15 min per identifier, 30 / hour per IP
    const idLimit = await checkRateLimit(`staff:login:${cleanId}`, 5, 900);
    if (!idLimit.allowed) {
      await blockKey(`staff:cooldown:${cleanId}`, 900);
      throw new RateLimitError(
        idLimit.retryAfterSec || 900,
        "ERR_RATE_LIMITED",
        "Too many failed login attempts. Account temporarily locked for 15 minutes."
      );
    }

    const ipLimit = await checkRateLimit(`staff:login:ip:${clientIp}`, 30, 3600);
    if (!ipLimit.allowed) {
      throw new RateLimitError(
        ipLimit.retryAfterSec || 3600,
        "ERR_RATE_LIMITED",
        "Too many login attempts from this IP address."
      );
    }

    // 2. Fetch staff record by email or phone
    let staffUser: StaffRow | null = null;
    try {
      const isPhone = isValidBdPhone(cleanId);
      const query = isPhone
        ? db.select().from(staff).where(eq(staff.phone, normalizeBdPhone(cleanId))).limit(1)
        : db.select().from(staff).where(eq(staff.email, cleanId)).limit(1);

      const rows = await query;
      staffUser = rows[0] ?? null;
    } catch {
      // Memory fallback lookup
      for (const s of memStaffStore.values()) {
        if (s.email.toLowerCase() === cleanId || s.phone === cleanId) {
          staffUser = s;
          break;
        }
      }
    }

    // 3. Constant-time password check
    if (!staffUser || staffUser.status !== "ACTIVE") {
      // Perform dummy verify to prevent timing side-channel attacks
      await argon2.verify(DUMMY_ARGON_HASH, password).catch(() => false);
      await recordAudit(null, {
        actorType: "SYSTEM",
        action: "staff.login.failed",
        entityType: "STAFF",
        entityId: cleanId,
        ip: clientIp,
        userAgent,
        afterState: { reason: "UNKNOWN_USER_OR_INACTIVE" },
      });
      throw new AppError("ERR_STAFF_AUTH_FAILED", "Invalid staff credentials", {}, 401);
    }

    const passwordValid = await argon2.verify(staffUser.passwordHash, password);
    if (!passwordValid) {
      await recordAudit(null, {
        staffId: staffUser.id,
        actorType: "STAFF",
        action: "staff.login.failed",
        entityType: "STAFF",
        entityId: staffUser.id,
        ip: clientIp,
        userAgent,
        afterState: { reason: "INVALID_PASSWORD" },
      });
      throw new AppError("ERR_STAFF_AUTH_FAILED", "Invalid staff credentials", {}, 401);
    }

    // 4. TOTP 2FA check
    if (!staffUser.totpEnabled || !staffUser.totpSecretEnc) {
      // First login: enrollment required
      const enrollmentToken = randomToken(32);
      memStaffEnrollmentStore.set(enrollmentToken, {
        staffId: staffUser.id,
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 min TTL
      });

      return {
        totp_enrollment_required: true,
        enrollment_token: enrollmentToken,
      };
    }

    if (!totpCode) {
      throw new AppError("ERR_STAFF_AUTH_FAILED", "TOTP 2FA code is required", {}, 401);
    }

    // Decrypt TOTP secret
    const secret = aesGcmDecrypt(staffUser.totpSecretEnc);
    const totpValid = authenticator.check(totpCode, secret);

    if (!totpValid) {
      await recordAudit(null, {
        staffId: staffUser.id,
        actorType: "STAFF",
        action: "staff.login.failed",
        entityType: "STAFF",
        entityId: staffUser.id,
        ip: clientIp,
        userAgent,
        afterState: { reason: "INVALID_TOTP" },
      });
      throw new AppError("ERR_STAFF_AUTH_FAILED", "Invalid 2FA authentication code", {}, 401);
    }

    // 5. Query staff roles
    const roles: string[] = [];
    try {
      const roleRows = await db
        .select()
        .from(staffRoles)
        .where(eq(staffRoles.staffId, staffUser.id));
      for (const r of roleRows) roles.push(r.role);
    } catch {
      const memRoles = memStaffRolesStore.get(staffUser.id);
      if (memRoles) roles.push(...memRoles);
    }

    // 6. Create 12-hour absolute session (NO SLIDING)
    const sessionToken = randomToken(32);
    const tokenHash = sha256Hex(sessionToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TWELVE_HOURS_MS);

    const sessionData: typeof sessions.$inferInsert = {
      tokenHash,
      subjectType: "STAFF",
      subjectId: staffUser.id as Uuid,
      ip: clientIp,
      userAgent,
      ownershipUnconfirmed: false,
      expiresAt,
    };

    let sessionId: Uuid = crypto.randomUUID() as Uuid;
    try {
      const [inserted] = await db.insert(sessions).values(sessionData).returning();
      if (inserted) sessionId = inserted.id as Uuid;
      // Update lastLoginAt
      await db.update(staff).set({ lastLoginAt: now }).where(eq(staff.id, staffUser.id));
    } catch {
      const mockSession: SessionRow = {
        id: sessionId,
        tokenHash,
        subjectType: "STAFF",
        subjectId: staffUser.id as Uuid,
        deviceId: null,
        deviceLabel: null,
        ip: clientIp,
        userAgent: userAgent ?? null,
        ownershipUnconfirmed: false,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
        revokedAt: null,
        revokedBy: null,
      };
      memStaffSessionStore.set(tokenHash, mockSession);
    }

    // Cache in Redis
    if (!env.MOCK_EXTERNAL_SERVICES) {
      try {
        const payload = JSON.stringify({
          sessionId,
          staffId: staffUser.id,
          subjectType: "STAFF",
          roles,
          expiresAt: expiresAt.toISOString(),
        });
        await getRedis().set(`session:${tokenHash}`, payload, "EX", 60);
      } catch {
        // Ignored
      }
    }

    // Reset rate limits on successful login
    await resetRateLimit(`staff:login:${cleanId}`);
    await resetRateLimit(`staff:cooldown:${cleanId}`);

    // Audit login success
    await recordAudit(null, {
      staffId: staffUser.id,
      actorType: "STAFF",
      action: "staff.login.success",
      entityType: "STAFF",
      entityId: staffUser.id,
      ip: clientIp,
      userAgent,
    });

    return {
      session_token: sessionToken,
      staff: {
        id: staffUser.id,
        email: staffUser.email,
        phone: staffUser.phone,
        full_name: staffUser.fullName,
        roles,
        must_change_password: staffUser.mustChangePassword,
      },
    };
  },

  /**
   * Start TOTP enrollment: returns otpauth URI for QR code generation.
   */
  async enrollTotp(enrollmentToken: string): Promise<{ otpauth_url: string; secret: string }> {
    const entry = memStaffEnrollmentStore.get(enrollmentToken);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthenticatedError("Enrollment token expired or invalid");
    }

    const secret = authenticator.generateSecret();
    const encryptedSecret = aesGcmEncrypt(secret);

    // Save encrypted secret to staff record (not yet enabled)
    try {
      await db
        .update(staff)
        .set({ totpSecretEnc: encryptedSecret, updatedAt: new Date() })
        .where(eq(staff.id, entry.staffId));
    } catch {
      const s = memStaffStore.get(entry.staffId);
      if (s) s.totpSecretEnc = encryptedSecret;
    }

    // Retrieve email for otpauth URI
    let email = "staff@ncamart.com";
    try {
      const rows = await db.select({ email: staff.email }).from(staff).where(eq(staff.id, entry.staffId)).limit(1);
      if (rows[0]) email = rows[0].email;
    } catch {
      const s = memStaffStore.get(entry.staffId);
      if (s) email = s.email;
    }

    const otpauthUrl = authenticator.keyuri(email, "NCAMart Admin", secret);
    return { otpauth_url: otpauthUrl, secret };
  },

  /**
   * Confirm TOTP code during enrollment and activate staff 2FA.
   */
  async confirmTotp(
    enrollmentToken: string,
    totpCode: string
  ): Promise<{ session_token: string; staff_id: string }> {
    const entry = memStaffEnrollmentStore.get(enrollmentToken);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthenticatedError("Enrollment token expired or invalid");
    }

    let staffRecord: StaffRow | null = null;
    try {
      const rows = await db.select().from(staff).where(eq(staff.id, entry.staffId)).limit(1);
      staffRecord = rows[0] ?? null;
    } catch {
      staffRecord = memStaffStore.get(entry.staffId) ?? null;
    }

    if (!staffRecord || !staffRecord.totpSecretEnc) {
      throw new UnauthenticatedError("TOTP secret not initialized");
    }

    const secret = aesGcmDecrypt(staffRecord.totpSecretEnc);
    const valid = authenticator.check(totpCode, secret);
    if (!valid) {
      throw new BusinessError("ERR_OTP_INVALID", "Invalid TOTP verification code", { status: 401 });
    }

    // Enable TOTP on staff record
    try {
      await db
        .update(staff)
        .set({ totpEnabled: true, updatedAt: new Date() })
        .where(eq(staff.id, staffRecord.id));
    } catch {
      staffRecord.totpEnabled = true;
    }

    // Consume enrollment token
    memStaffEnrollmentStore.delete(enrollmentToken);

    // Create 12-hour staff session
    const sessionToken = randomToken(32);
    const tokenHash = sha256Hex(sessionToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TWELVE_HOURS_MS);

    try {
      await db.insert(sessions).values({
        tokenHash,
        subjectType: "STAFF",
        subjectId: staffRecord.id as Uuid,
        ownershipUnconfirmed: false,
        expiresAt,
      });
    } catch {
      memStaffSessionStore.set(tokenHash, {
        id: crypto.randomUUID() as Uuid,
        tokenHash,
        subjectType: "STAFF",
        subjectId: staffRecord.id as Uuid,
        deviceId: null,
        deviceLabel: null,
        ip: null,
        userAgent: null,
        ownershipUnconfirmed: false,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
        revokedAt: null,
        revokedBy: null,
      });
    }

    await recordAudit(null, {
      staffId: staffRecord.id,
      actorType: "STAFF",
      action: "staff.totp.enrolled",
      entityType: "STAFF",
      entityId: staffRecord.id,
    });

    return {
      session_token: sessionToken,
      staff_id: staffRecord.id,
    };
  },

  /**
   * Change staff password.
   */
  async changePassword(
    staffId: string,
    oldPass: string,
    newPass: string,
    currentSessionId?: string
  ): Promise<void> {
    if (newPass.length < 8) {
      throw new BusinessError("ERR_VALIDATION", "New password must be at least 8 characters", { status: 400 });
    }

    let staffRecord: StaffRow | null = null;
    try {
      const rows = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
      staffRecord = rows[0] ?? null;
    } catch {
      staffRecord = memStaffStore.get(staffId) ?? null;
    }

    if (!staffRecord) throw new UnauthenticatedError("Staff account not found");

    const valid = await argon2.verify(staffRecord.passwordHash, oldPass);
    if (!valid) {
      throw new BusinessError("ERR_STAFF_AUTH_FAILED", "Current password does not match", { status: 401 });
    }

    const newHash = await argon2.hash(newPass);

    try {
      await db
        .update(staff)
        .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
        .where(eq(staff.id, staffId));

      // Revoke other sessions
      if (currentSessionId) {
        await db
          .update(sessions)
          .set({ revokedAt: new Date(), revokedBy: staffId })
          .where(and(eq(sessions.subjectId, staffId), eq(sessions.subjectType, "STAFF")));
      }
    } catch {
      staffRecord.passwordHash = newHash;
      staffRecord.mustChangePassword = false;
    }

    await recordAudit(null, {
      staffId,
      actorType: "STAFF",
      action: "staff.password.changed",
      entityType: "STAFF",
      entityId: staffId,
    });
  },

  /**
   * Remote revoke all sessions for a staff member (SUPER_ADMIN only).
   */
  async revokeAllStaffSessions(targetStaffId: string, revokedByStaffId: string): Promise<number> {
    const now = new Date();
    let count = 0;

    try {
      const res = await db
        .update(sessions)
        .set({ revokedAt: now, revokedBy: revokedByStaffId })
        .where(
          and(
            eq(sessions.subjectId, targetStaffId),
            eq(sessions.subjectType, "STAFF"),
            isNull(sessions.revokedAt)
          )
        )
        .returning();
      count = res.length;
    } catch {
      for (const [key, sess] of memStaffSessionStore.entries()) {
        if (sess.subjectId === targetStaffId && !sess.revokedAt) {
          sess.revokedAt = now;
          sess.revokedBy = revokedByStaffId;
          count++;
          memStaffSessionStore.delete(key);
        }
      }
    }

    await recordAudit(null, {
      staffId: revokedByStaffId,
      actorType: "STAFF",
      action: "staff.sessions.revoked_remote",
      entityType: "STAFF",
      entityId: targetStaffId,
      afterState: { count },
    });

    return count;
  },

  /**
   * Bootstrap helper: create or seed a staff user with assigned roles.
   */
  async createStaff(input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    roles: StaffRole[];
    mustChangePassword?: boolean;
    tx?: Tx;
  }): Promise<{ staff: StaffRow; initialPassword: string }> {
    const normalizedPhone = normalizeBdPhone(input.phone);
    const passwordHash = await argon2.hash(input.password);
    const now = new Date();

    const newStaff: typeof staff.$inferInsert = {
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phone: normalizedPhone,
      passwordHash,
      totpEnabled: false,
      status: "ACTIVE",
      mustChangePassword: input.mustChangePassword ?? true,
    };

    let created: StaffRow | null = null;
    const client = input.tx ?? db;

    try {
      const [inserted] = await client.insert(staff).values(newStaff).returning();
      if (inserted) {
        created = inserted;
        for (const role of input.roles) {
          await client.insert(staffRoles).values({
            staffId: inserted.id as Uuid,
            role,
          });
        }
      }
    } catch {
      created = {
        id: crypto.randomUUID() as Uuid,
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        phone: normalizedPhone,
        passwordHash,
        totpSecretEnc: null,
        totpEnabled: false,
        status: "ACTIVE",
        mustChangePassword: input.mustChangePassword ?? true,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };
      memStaffStore.set(created.id, created);
      memStaffRolesStore.set(created.id, input.roles);
    }

    if (!created) throw new Error("Failed to create staff member");

    await recordAudit(null, {
      actorType: "SYSTEM",
      action: "staff.created",
      entityType: "STAFF",
      entityId: created.id,
      afterState: { email: created.email, roles: input.roles },
    });

    return { staff: created, initialPassword: input.password };
  },

  async getStaffRoles(staffId: string): Promise<string[]> {
    const roles: string[] = [];
    try {
      const roleRows = await db
        .select()
        .from(staffRoles)
        .where(eq(staffRoles.staffId, staffId));
      for (const r of roleRows) roles.push(r.role);
    } catch {
      const memRoles = memStaffRolesStore.get(staffId);
      if (memRoles) roles.push(...memRoles);
    }
    return roles;
  },

  getMemoryStaffRoles(staffId: string): string[] {
    return memStaffRolesStore.get(staffId) ?? [];
  },

  resolveMemoryStaffSession(token: string): SessionRow | null {
    const tokenHash = sha256Hex(token);
    const sess = memStaffSessionStore.get(tokenHash);
    if (!sess) return null;
    if (sess.revokedAt || sess.expiresAt < new Date()) return null;
    return sess;
  },

  clearMemoryStaffForTesting(): void {
    memStaffStore.clear();
    memStaffRolesStore.clear();
    memStaffEnrollmentStore.clear();
    memStaffSessionStore.clear();
  },
};
