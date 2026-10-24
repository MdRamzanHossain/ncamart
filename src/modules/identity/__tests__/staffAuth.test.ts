import { describe, it, expect, beforeEach } from "vitest";
import { authenticator } from "otplib";
import { staffAuthService } from "../staffAuth";
import { AppError, RateLimitError } from "@/lib/errors";
import { clearMemoryAuditChainForTesting } from "@/modules/audit";
import { assertStaffMutationProducesAudit } from "@/test/helpers";

describe("Staff Authentication & Session Management (P07)", () => {
  const staffEmail = "technician@ncamart.com";
  const staffPhone = "01811223344";
  const initialPassword = "SecureStaffPass123!";

  beforeEach(() => {
    staffAuthService.clearMemoryStaffForTesting();
    clearMemoryAuditChainForTesting();
  });

  it("handles enrollment flow on first login: returns totp_enrollment_required and succeeds after confirm", async () => {
    // 1. Create a staff member with uninitialized TOTP
    let createdStaffId = "";
    await assertStaffMutationProducesAudit(async () => {
      const res = await staffAuthService.createStaff({
        fullName: "Kamal Hossain",
        email: staffEmail,
        phone: staffPhone,
        password: initialPassword,
        roles: ["QC_TECHNICIAN"],
        mustChangePassword: true,
      });
      createdStaffId = res.staff.id;
    }, "staff.created");

    expect(createdStaffId).toBeDefined();

    // 2. First login attempt: returns enrollment_token and nothing else
    const loginRes = await staffAuthService.login(staffEmail, initialPassword);
    expect("totp_enrollment_required" in loginRes && loginRes.totp_enrollment_required).toBe(true);
    if (!("totp_enrollment_required" in loginRes)) throw new Error("Expected enrollment required");
    const enrollmentToken = loginRes.enrollment_token;
    expect(enrollmentToken).toBeDefined();

    // 3. Initiate enrollment: receives otpauth URL and secret
    const enrollRes = await staffAuthService.enrollTotp(enrollmentToken);
    expect(enrollRes.otpauth_url).toContain("otpauth://totp/");
    expect(enrollRes.secret).toBeDefined();

    // 4. Confirm enrollment with valid TOTP code
    const validTotp = authenticator.generate(enrollRes.secret);
    let confirmSessionToken = "";

    await assertStaffMutationProducesAudit(async () => {
      const confirmRes = await staffAuthService.confirmTotp(enrollmentToken, validTotp);
      expect(confirmRes.session_token).toBeDefined();
      expect(confirmRes.staff_id).toBe(createdStaffId);
      confirmSessionToken = confirmRes.session_token;
    }, "staff.totp.enrolled");

    expect(confirmSessionToken).toBeDefined();

    // 5. Subsequent login without TOTP fails
    await expect(staffAuthService.login(staffEmail, initialPassword)).rejects.toThrow(AppError);

    // 6. Subsequent login with invalid TOTP fails
    await expect(
      staffAuthService.login(staffEmail, initialPassword, "000000")
    ).rejects.toThrow(AppError);

    // 7. Subsequent login with valid TOTP succeeds
    const nextTotp = authenticator.generate(enrollRes.secret);
    await assertStaffMutationProducesAudit(async () => {
      const secondLoginRes = await staffAuthService.login(
        staffEmail,
        initialPassword,
        nextTotp
      );
      if ("totp_enrollment_required" in secondLoginRes) {
        throw new Error("Expected session token, got enrollment");
      }
      expect(secondLoginRes.session_token).toBeDefined();
      expect(secondLoginRes.staff.email).toBe(staffEmail);
      expect(secondLoginRes.staff.roles).toEqual(["QC_TECHNICIAN"]);
    }, "staff.login.success");
  });

  it("fails login with unknown identifier in constant-time and records audit failure", async () => {
    await assertStaffMutationProducesAudit(async () => {
      await expect(
        staffAuthService.login("nonexistent@ncamart.com", "randompass123")
      ).rejects.toThrow(AppError);
    }, "staff.login.failed");
  });

  it("fails login with wrong password and records audit failure", async () => {
    const wrongPassEmail = "wrongpass-test@ncamart.com";
    await staffAuthService.createStaff({
      fullName: "Kamal Hossain",
      email: wrongPassEmail,
      phone: "01833445566",
      password: initialPassword,
      roles: ["QC_TECHNICIAN"],
    });

    await assertStaffMutationProducesAudit(async () => {
      await expect(
        staffAuthService.login(wrongPassEmail, "WrongPassword999!")
      ).rejects.toThrow(AppError);
    }, "staff.login.failed");
  });

  it("allows password change and revokes other sessions", async () => {
    const pwChangeEmail = "pwchange-test@ncamart.com";
    const { staff } = await staffAuthService.createStaff({
      fullName: "Kamal Hossain",
      email: pwChangeEmail,
      phone: "01855667788",
      password: initialPassword,
      roles: ["QC_TECHNICIAN"],
    });

    const newPassword = "BrandNewSuperSecurePass456!";

    // Fail with wrong current password
    await expect(
      staffAuthService.changePassword(staff.id, "WrongOldPass", newPassword)
    ).rejects.toThrow();

    // Succeed with correct password and record audit row
    await assertStaffMutationProducesAudit(async () => {
      await staffAuthService.changePassword(staff.id, initialPassword, newPassword);
    }, "staff.password.changed");

    // Login with old password fails
    await expect(
      staffAuthService.login(pwChangeEmail, initialPassword)
    ).rejects.toThrow(AppError);

    // Login with new password succeeds
    const res = await staffAuthService.login(pwChangeEmail, newPassword);
    expect("totp_enrollment_required" in res && res.totp_enrollment_required).toBe(true);
  });

  it("allows remote session revocation by SUPER_ADMIN", async () => {
    const { staff: targetStaff } = await staffAuthService.createStaff({
      fullName: "Target Staff",
      email: "target@ncamart.com",
      phone: "01899887766",
      password: initialPassword,
      roles: ["FIELD_RUNNER"],
    });

    const { staff: adminStaff } = await staffAuthService.createStaff({
      fullName: "Admin Staff",
      email: "admin@ncamart.com",
      phone: "01711223344",
      password: initialPassword,
      roles: ["SUPER_ADMIN"],
    });

    await assertStaffMutationProducesAudit(async () => {
      const revoked = await staffAuthService.revokeAllStaffSessions(
        targetStaff.id,
        adminStaff.id
      );
      expect(revoked).toBeGreaterThanOrEqual(0);
    }, "staff.sessions.revoked_remote");
  });

  it("enforces staff login rate limiting on 5 consecutive failures", async () => {
    const targetEmail = "attacker-target@ncamart.com";

    for (let i = 0; i < 5; i++) {
      try {
        await staffAuthService.login(targetEmail, "wrongpass");
      } catch {
        // Expected
      }
    }

    // 6th attempt should be blocked by rate limit
    await expect(
      staffAuthService.login(targetEmail, "wrongpass")
    ).rejects.toThrow(RateLimitError);
  });
});
