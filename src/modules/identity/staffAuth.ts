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
    userAgent?: string,
    options?: { allowUnenrolledTotp?: boolean }
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
      if (!options?.allowUnenrolledTotp) {
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
    } else {
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

  setMemoryStaff(staffId: string, roles: StaffRole[]): void {
    memStaffRolesStore.set(staffId, roles);
  },

  setMemoryStaffSession(token: string, staffId: string): void {
    const tokenHash = sha256Hex(token);
    const now = new Date();
    memStaffSessionStore.set(tokenHash, {
      id: crypto.randomUUID() as Uuid,
      tokenHash,
      subjectType: "STAFF",
      subjectId: staffId as Uuid,
      deviceId: null,
      deviceLabel: null,
      ip: null,
      userAgent: null,
      ownershipUnconfirmed: false,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
      revokedAt: null,
      revokedBy: null,
    });
  },

  resolveMemoryStaffSession(token: string): SessionRow | null {
    const tokenHash = sha256Hex(token);
    const sess = memStaffSessionStore.get(tokenHash);
    if (!sess) return null;
    if (sess.revokedAt || sess.expiresAt < new Date()) return null;
    return sess;
  },

  async isStaffSessionActive(sessionId: string): Promise<boolean> {
    const now = new Date();
    // 1. Check in-memory store
    for (const sess of memStaffSessionStore.values()) {
      if (sess.id === sessionId) {
        if (sess.revokedAt || sess.expiresAt < now) return false;
        return true;
      }
    }

    // 2. Query database if available
    try {
      const rows = await db
        .select({ revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.id, sessionId as Uuid))
        .limit(1);
      if (!rows[0]) return false;
      return !rows[0].revokedAt && rows[0].expiresAt > now;
    } catch {
      return false;
    }
  },

  async listStaff(filter?: {
    role?: StaffRole;
    status?: "ACTIVE" | "SUSPENDED";
    page?: number;
    limit?: number;
  }): Promise<{ data: Array<{
    id: string;
    full_name: string;
    email: string;
    phone: string;
    status: string;
    roles: string[];
    totp_enabled: boolean;
    must_change_password: boolean;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
  }>; total: number; page: number; limit: number }> {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const offset = (page - 1) * limit;

    try {
      const allRows = await db.select().from(staff).orderBy(staff.createdAt);
      const rolesRows = await db.select().from(staffRoles);
      const roleMap = new Map<string, string[]>();
      for (const r of rolesRows) {
        const cur = roleMap.get(r.staffId) ?? [];
        cur.push(r.role);
        roleMap.set(r.staffId, cur);
      }

      let filtered = allRows.map((s) => ({
        id: s.id,
        full_name: s.fullName,
        email: s.email,
        phone: s.phone,
        status: s.status,
        roles: roleMap.get(s.id) ?? [],
        totp_enabled: s.totpEnabled,
        must_change_password: s.mustChangePassword,
        last_login_at: s.lastLoginAt ? new Date(s.lastLoginAt).toISOString() : null,
        created_at: new Date(s.createdAt).toISOString(),
        updated_at: new Date(s.updatedAt).toISOString(),
      }));

      if (filter?.status) {
        filtered = filtered.filter((s) => s.status === filter.status);
      }
      if (filter?.role) {
        filtered = filtered.filter((s) => s.roles.includes(filter.role!));
      }

      const total = filtered.length;
      const data = filtered.slice(offset, offset + limit);
      return { data, total, page, limit };
    } catch {
      // Memory fallback
      let memList = Array.from(memStaffStore.values()).map((s) => ({
        id: s.id,
        full_name: s.fullName,
        email: s.email,
        phone: s.phone,
        status: s.status,
        roles: memStaffRolesStore.get(s.id) ?? [],
        totp_enabled: s.totpEnabled,
        must_change_password: s.mustChangePassword,
        last_login_at: s.lastLoginAt ? new Date(s.lastLoginAt).toISOString() : null,
        created_at: new Date(s.createdAt).toISOString(),
        updated_at: new Date(s.updatedAt).toISOString(),
      }));

      if (filter?.status) {
        memList = memList.filter((s) => s.status === filter.status);
      }
      if (filter?.role) {
        memList = memList.filter((s) => s.roles.includes(filter.role!));
      }

      const total = memList.length;
      const data = memList.slice(offset, offset + limit);
      return { data, total, page, limit };
    }
  },

  async getStaffById(id: string): Promise<{
    id: string;
    full_name: string;
    email: string;
    phone: string;
    status: string;
    roles: string[];
    totp_enabled: boolean;
    must_change_password: boolean;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
  } | null> {
    try {
      const rows = await db.select().from(staff).where(eq(staff.id, id as Uuid)).limit(1);
      if (rows[0]) {
        const roles = await this.getStaffRoles(id);
        const s = rows[0];
        return {
          id: s.id,
          full_name: s.fullName,
          email: s.email,
          phone: s.phone,
          status: s.status,
          roles,
          totp_enabled: s.totpEnabled,
          must_change_password: s.mustChangePassword,
          last_login_at: s.lastLoginAt ? new Date(s.lastLoginAt).toISOString() : null,
          created_at: new Date(s.createdAt).toISOString(),
          updated_at: new Date(s.updatedAt).toISOString(),
        };
      }
    } catch {
      // fallback
    }

    const mem = memStaffStore.get(id);
    if (!mem) return null;
    const roles = memStaffRolesStore.get(id) ?? [];
    return {
      id: mem.id,
      full_name: mem.fullName,
      email: mem.email,
      phone: mem.phone,
      status: mem.status,
      roles,
      totp_enabled: mem.totpEnabled,
      must_change_password: mem.mustChangePassword,
      last_login_at: mem.lastLoginAt ? new Date(mem.lastLoginAt).toISOString() : null,
      created_at: new Date(mem.createdAt).toISOString(),
      updated_at: new Date(mem.updatedAt).toISOString(),
    };
  },

  async countOtherActiveSuperAdmins(excludeStaffId: string): Promise<number> {
    let count = 0;
    try {
      const rows = await db.select().from(staff).where(eq(staff.status, "ACTIVE"));
      for (const s of rows) {
        if (s.id !== excludeStaffId) {
          const roles = await this.getStaffRoles(s.id);
          if (roles.includes("SUPER_ADMIN")) {
            count++;
          }
        }
      }
      return count;
    } catch {
      for (const [id, s] of memStaffStore.entries()) {
        if (id !== excludeStaffId && s.status === "ACTIVE") {
          const roles = memStaffRolesStore.get(id) ?? [];
          if (roles.includes("SUPER_ADMIN")) {
            count++;
          }
        }
      }
      return count;
    }
  },

  async updateStaff(
    id: string,
    updates: {
      fullName?: string;
      email?: string;
      phone?: string;
      roles?: StaffRole[];
      status?: "ACTIVE" | "SUSPENDED";
    },
    actor: { id: string; type?: string }
  ): Promise<{
    id: string;
    full_name: string;
    email: string;
    phone: string;
    status: string;
    roles: string[];
    totp_enabled: boolean;
    must_change_password: boolean;
    updated_at: string;
  }> {
    const existing = await this.getStaffById(id);
    if (!existing) {
      throw new BusinessError("ERR_NOT_FOUND", "Staff member not found", {}, 404);
    }

    const currentRoles = existing.roles;
    const isCurrentlySuperAdmin = currentRoles.includes("SUPER_ADMIN") && existing.status === "ACTIVE";

    // Enforce Last SUPER_ADMIN protection
    if (isCurrentlySuperAdmin) {
      const willDemote = updates.roles !== undefined && !updates.roles.includes("SUPER_ADMIN");
      const willSuspend = updates.status !== undefined && updates.status !== "ACTIVE";

      if (willDemote || willSuspend) {
        const otherAdmins = await this.countOtherActiveSuperAdmins(id);
        if (otherAdmins === 0) {
          throw new BusinessError(
            "ERR_LAST_SUPER_ADMIN",
            "Cannot remove or suspend the last active SUPER_ADMIN",
            { staffId: id },
            422
          );
        }
      }
    }

    const now = new Date();
    const updatedStatus = updates.status ?? (existing.status as "ACTIVE" | "SUSPENDED");
    const updatedFullName = updates.fullName ?? existing.full_name;
    const updatedEmail = updates.email ? updates.email.toLowerCase() : existing.email;
    const updatedPhone = updates.phone ? normalizeBdPhone(updates.phone) : existing.phone;
    const updatedRoles = updates.roles ?? (existing.roles as StaffRole[]);

    try {
      await db
        .update(staff)
        .set({
          fullName: updatedFullName,
          email: updatedEmail,
          phone: updatedPhone,
          status: updatedStatus,
          updatedAt: now,
        })
        .where(eq(staff.id, id as Uuid));

      if (updates.roles) {
        await db.delete(staffRoles).where(eq(staffRoles.staffId, id as Uuid));
        for (const role of updates.roles) {
          await db.insert(staffRoles).values({ staffId: id as Uuid, role });
        }
      }
    } catch {
      // Memory fallback
      const mem = memStaffStore.get(id);
      if (mem) {
        mem.fullName = updatedFullName;
        mem.email = updatedEmail;
        mem.phone = updatedPhone;
        mem.status = updatedStatus;
        mem.updatedAt = now;
      }
      if (updates.roles) {
        memStaffRolesStore.set(id, updates.roles);
      }
    }

    await recordAudit(null, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "staff.updated",
      entityType: "STAFF",
      entityId: id,
      beforeState: {
        fullName: existing.full_name,
        email: existing.email,
        phone: existing.phone,
        status: existing.status,
        roles: existing.roles,
      },
      afterState: {
        fullName: updatedFullName,
        email: updatedEmail,
        phone: updatedPhone,
        status: updatedStatus,
        roles: updatedRoles,
      },
    });

    return {
      id,
      full_name: updatedFullName,
      email: updatedEmail,
      phone: updatedPhone,
      status: updatedStatus,
      roles: updatedRoles,
      totp_enabled: existing.totp_enabled,
      must_change_password: existing.must_change_password,
      updated_at: now.toISOString(),
    };
  },

  async resetStaffPassword(
    id: string,
    actor: { id: string }
  ): Promise<{ temporaryPassword: string }> {
    const existing = await this.getStaffById(id);
    if (!existing) {
      throw new BusinessError("ERR_NOT_FOUND", "Staff member not found", {}, 404);
    }

    const tempPassword = `Nca#${crypto.randomBytes(6).toString("hex")}!`;
    const passwordHash = await argon2.hash(tempPassword);
    const now = new Date();

    try {
      await db
        .update(staff)
        .set({
          passwordHash,
          mustChangePassword: true,
          updatedAt: now,
        })
        .where(eq(staff.id, id as Uuid));
    } catch {
      const mem = memStaffStore.get(id);
      if (mem) {
        mem.passwordHash = passwordHash;
        mem.mustChangePassword = true;
        mem.updatedAt = now;
      }
    }

    // Revoke all existing sessions
    await this.revokeAllStaffSessions(id, actor.id);

    await recordAudit(null, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "staff.password_reset",
      entityType: "STAFF",
      entityId: id,
      afterState: { mustChangePassword: true },
    });

    return { temporaryPassword: tempPassword };
  },

  async resetStaffTotp(
    id: string,
    actor: { id: string }
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.getStaffById(id);
    if (!existing) {
      throw new BusinessError("ERR_NOT_FOUND", "Staff member not found", {}, 404);
    }

    const now = new Date();
    try {
      await db
        .update(staff)
        .set({
          totpSecretEnc: null,
          totpEnabled: false,
          updatedAt: now,
        })
        .where(eq(staff.id, id as Uuid));
    } catch {
      const mem = memStaffStore.get(id);
      if (mem) {
        mem.totpSecretEnc = null;
        mem.totpEnabled = false;
        mem.updatedAt = now;
      }
    }

    // Revoke all existing sessions
    await this.revokeAllStaffSessions(id, actor.id);

    await recordAudit(null, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "staff.totp_reset",
      entityType: "STAFF",
      entityId: id,
      afterState: { totpEnabled: false },
    });

    return { success: true, message: "TOTP credentials reset successfully" };
  },

  createMockStaffSession(staffId: string, token: string, roles: StaffRole[]): SessionRow {
    const tokenHash = sha256Hex(token);
    const now = new Date();
    const expiresAt = new Date(Date.now() + TWELVE_HOURS_MS);
    const sess: SessionRow = {
      id: crypto.randomUUID() as Uuid,
      tokenHash,
      subjectType: "STAFF",
      subjectId: staffId as Uuid,
      deviceId: "dev-test",
      deviceLabel: "Test Device",
      ip: "127.0.0.1",
      userAgent: "Vitest",
      ownershipUnconfirmed: false,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      revokedAt: null,
      revokedBy: null,
    };
    memStaffSessionStore.set(tokenHash, sess);
    memStaffRolesStore.set(staffId, roles);
    return sess;
  },

  async getSelfProfile(staffId: string, currentSessionId?: string) {
    const profile = await this.getStaffById(staffId);
    if (!profile) {
      throw new BusinessError("ERR_NOT_FOUND", "Staff profile not found", {}, 404);
    }
    const activeSessions = await this.listStaffSessions(staffId, currentSessionId);
    return {
      staff: profile,
      sessions: activeSessions,
    };
  },

  async updateSelfProfile(
    staffId: string,
    updates: {
      fullName?: string;
      email?: string;
      phone?: string;
    }
  ) {
    const existing = await this.getStaffById(staffId);
    if (!existing) {
      throw new BusinessError("ERR_NOT_FOUND", "Staff member not found", {}, 404);
    }

    const updatedFullName = updates.fullName?.trim() || existing.full_name;
    if (updatedFullName.length < 2) {
      throw new BusinessError("ERR_VALIDATION", "Full name must be at least 2 characters", {}, 400);
    }

    const updatedEmail = updates.email ? updates.email.trim().toLowerCase() : existing.email;
    let updatedPhone = existing.phone;
    if (updates.phone) {
      if (!isValidBdPhone(updates.phone.trim())) {
        throw new BusinessError(
          "ERR_INVALID_PHONE",
          "Please enter a valid Bangladesh mobile number (e.g. +8801712345678)",
          {},
          400
        );
      }
      updatedPhone = normalizeBdPhone(updates.phone.trim());
    }

    const now = new Date();
    try {
      await db
        .update(staff)
        .set({
          fullName: updatedFullName,
          email: updatedEmail,
          phone: updatedPhone,
          updatedAt: now,
        })
        .where(eq(staff.id, staffId as Uuid));
    } catch {
      const mem = memStaffStore.get(staffId);
      if (mem) {
        mem.fullName = updatedFullName;
        mem.email = updatedEmail;
        mem.phone = updatedPhone;
        mem.updatedAt = now;
      }
    }

    await recordAudit(null, {
      staffId,
      actorType: "STAFF",
      action: "staff.profile.self_updated",
      entityType: "STAFF",
      entityId: staffId,
      beforeState: {
        fullName: existing.full_name,
        email: existing.email,
        phone: existing.phone,
      },
      afterState: {
        fullName: updatedFullName,
        email: updatedEmail,
        phone: updatedPhone,
      },
    });

    return {
      id: staffId,
      full_name: updatedFullName,
      email: updatedEmail,
      phone: updatedPhone,
      status: existing.status,
      roles: existing.roles,
      totp_enabled: existing.totp_enabled,
      must_change_password: existing.must_change_password,
      updated_at: now.toISOString(),
    };
  },

  async initSelfTotpEnrollment(
    staffId: string
  ): Promise<{ secret: string; otpauth_url: string; email: string }> {
    const existing = await this.getStaffById(staffId);
    if (!existing) {
      throw new BusinessError("ERR_NOT_FOUND", "Staff member not found", {}, 404);
    }

    const secret = authenticator.generateSecret();
    const encryptedSecret = aesGcmEncrypt(secret);
    const now = new Date();

    try {
      await db
        .update(staff)
        .set({ totpSecretEnc: encryptedSecret, updatedAt: now })
        .where(eq(staff.id, staffId as Uuid));
    } catch {
      const mem = memStaffStore.get(staffId);
      if (mem) {
        mem.totpSecretEnc = encryptedSecret;
        mem.updatedAt = now;
      }
    }

    const otpauthUrl = authenticator.keyuri(existing.email, "NCAMart Admin", secret);
    return {
      secret,
      otpauth_url: otpauthUrl,
      email: existing.email,
    };
  },

  async confirmSelfTotpEnrollment(
    staffId: string,
    totpCode: string
  ): Promise<{ totp_enabled: boolean; message: string }> {
    let staffRecord: StaffRow | null = null;
    try {
      const rows = await db.select().from(staff).where(eq(staff.id, staffId as Uuid)).limit(1);
      staffRecord = rows[0] ?? null;
    } catch {
      staffRecord = memStaffStore.get(staffId) ?? null;
    }

    if (!staffRecord || !staffRecord.totpSecretEnc) {
      throw new BusinessError(
        "ERR_VALIDATION",
        "Please generate a 2FA secret key first before verifying.",
        {},
        400
      );
    }

    const secret = aesGcmDecrypt(staffRecord.totpSecretEnc);
    const valid = authenticator.check(totpCode.trim(), secret);
    if (!valid) {
      throw new BusinessError(
        "ERR_OTP_INVALID",
        "Invalid 6-digit authenticator code. Please check your app and try again.",
        { status: 401 },
        401
      );
    }

    const now = new Date();
    try {
      await db
        .update(staff)
        .set({ totpEnabled: true, updatedAt: now })
        .where(eq(staff.id, staffId as Uuid));
    } catch {
      staffRecord.totpEnabled = true;
      staffRecord.updatedAt = now;
    }

    await recordAudit(null, {
      staffId,
      actorType: "STAFF",
      action: "staff.totp.self_enrolled",
      entityType: "STAFF",
      entityId: staffId,
      afterState: { totpEnabled: true },
    });

    return {
      totp_enabled: true,
      message: "Two-Factor Authentication (2FA) is now active on your account.",
    };
  },

  async disableSelfTotp(
    staffId: string,
    password: string
  ): Promise<{ totp_enabled: boolean; message: string }> {
    let staffRecord: StaffRow | null = null;
    try {
      const rows = await db.select().from(staff).where(eq(staff.id, staffId as Uuid)).limit(1);
      staffRecord = rows[0] ?? null;
    } catch {
      staffRecord = memStaffStore.get(staffId) ?? null;
    }

    if (!staffRecord) {
      throw new BusinessError("ERR_NOT_FOUND", "Staff account not found", {}, 404);
    }

    const passwordValid = await argon2.verify(staffRecord.passwordHash, password);
    if (!passwordValid) {
      throw new BusinessError(
        "ERR_STAFF_AUTH_FAILED",
        "Current password is incorrect. Cannot disable 2FA.",
        { status: 401 },
        401
      );
    }

    const now = new Date();
    try {
      await db
        .update(staff)
        .set({ totpEnabled: false, totpSecretEnc: null, updatedAt: now })
        .where(eq(staff.id, staffId as Uuid));
    } catch {
      staffRecord.totpEnabled = false;
      staffRecord.totpSecretEnc = null;
      staffRecord.updatedAt = now;
    }

    await recordAudit(null, {
      staffId,
      actorType: "STAFF",
      action: "staff.totp.self_disabled",
      entityType: "STAFF",
      entityId: staffId,
      afterState: { totpEnabled: false },
    });

    return {
      totp_enabled: false,
      message: "Two-Factor Authentication (2FA) has been disabled.",
    };
  },

  async listStaffSessions(staffId: string, currentSessionId?: string) {
    const now = new Date();
    try {
      const rows = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.subjectId, staffId as Uuid),
            eq(sessions.subjectType, "STAFF"),
            isNull(sessions.revokedAt)
          )
        );
      return rows
        .filter((s) => new Date(s.expiresAt) > now)
        .map((s) => ({
          id: s.id,
          ip: s.ip || "127.0.0.1",
          user_agent: s.userAgent || "Web Browser",
          created_at: new Date(s.createdAt).toISOString(),
          last_seen_at: new Date(s.lastSeenAt).toISOString(),
          expires_at: new Date(s.expiresAt).toISOString(),
          is_current: s.id === currentSessionId,
        }));
    } catch {
      const list = [];
      for (const s of memStaffSessionStore.values()) {
        if (s.subjectId === staffId && !s.revokedAt && s.expiresAt > now) {
          list.push({
            id: s.id,
            ip: s.ip || "127.0.0.1",
            user_agent: s.userAgent || "Web Browser",
            created_at: s.createdAt.toISOString(),
            last_seen_at: s.lastSeenAt.toISOString(),
            expires_at: s.expiresAt.toISOString(),
            is_current: s.id === currentSessionId,
          });
        }
      }
      return list;
    }
  },

  async revokeOtherStaffSessions(staffId: string, currentSessionId?: string): Promise<number> {
    const now = new Date();
    let revokedCount = 0;
    try {
      const rows = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.subjectId, staffId as Uuid),
            eq(sessions.subjectType, "STAFF"),
            isNull(sessions.revokedAt)
          )
        );
      for (const s of rows) {
        if (s.id !== currentSessionId) {
          await db
            .update(sessions)
            .set({ revokedAt: now, revokedBy: staffId })
            .where(eq(sessions.id, s.id));
          revokedCount++;
        }
      }
    } catch {
      for (const [key, sess] of memStaffSessionStore.entries()) {
        if (sess.subjectId === staffId && sess.id !== currentSessionId && !sess.revokedAt) {
          sess.revokedAt = now;
          sess.revokedBy = staffId;
          revokedCount++;
          memStaffSessionStore.delete(key);
        }
      }
    }

    await recordAudit(null, {
      staffId,
      actorType: "STAFF",
      action: "staff.sessions.self_revoked_others",
      entityType: "STAFF",
      entityId: staffId,
      afterState: { revokedCount },
    });

    return revokedCount;
  },

  clearMemoryStaffForTesting(): void {
    memStaffStore.clear();
    memStaffRolesStore.clear();
    memStaffEnrollmentStore.clear();
    memStaffSessionStore.clear();
  },
};
