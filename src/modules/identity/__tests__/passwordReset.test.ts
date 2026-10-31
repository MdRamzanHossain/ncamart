import { describe, it, expect, beforeEach } from "vitest";
import { POST as handleResetRequest } from "@/app/api/v1/auth/password/reset-request/route";
import { POST as handleResetConfirm } from "@/app/api/v1/auth/password/reset-confirm/route";
import { NextRequest } from "next/server";
import { staffAuthService } from "../staffAuth";

describe("Password Reset System (SMS, WhatsApp, Email)", () => {
  const testPhone = "01799887766";
  const testEmail = "reset.user@ncamart.com";

  beforeEach(() => {
    staffAuthService.clearMemoryStaffForTesting();
  });

  it("handles reset request via SMS successfully", async () => {
    const req = new NextRequest("http://localhost/api/v1/auth/password/reset-request", {
      method: "POST",
      body: JSON.stringify({
        identifier: testPhone,
        channel: "sms",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await handleResetRequest(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.channel).toBe("sms");
    expect(data.destination).toBeDefined();
    expect(data.demoOtp).toBeDefined();
  });

  it("handles reset request via WhatsApp and returns wa.me direct link", async () => {
    const req = new NextRequest("http://localhost/api/v1/auth/password/reset-request", {
      method: "POST",
      body: JSON.stringify({
        identifier: testPhone,
        channel: "whatsapp",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await handleResetRequest(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.channel).toBe("whatsapp");
    expect(data.whatsappLink).toContain("https://wa.me/");
  });

  it("handles reset request via Email successfully", async () => {
    const req = new NextRequest("http://localhost/api/v1/auth/password/reset-request", {
      method: "POST",
      body: JSON.stringify({
        identifier: testEmail,
        channel: "email",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await handleResetRequest(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.channel).toBe("email");
    expect(data.destination).toContain("***@ncamart.com");
  });

  it("confirms password reset with valid OTP and updates credentials", async () => {
    // 1. Request OTP
    const req1 = new NextRequest("http://localhost/api/v1/auth/password/reset-request", {
      method: "POST",
      body: JSON.stringify({
        identifier: testPhone,
        channel: "sms",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res1 = await handleResetRequest(req1);
    const data1 = await res1.json();
    const otp = data1.demoOtp;
    expect(otp).toBeDefined();

    // 2. Confirm Reset
    const req2 = new NextRequest("http://localhost/api/v1/auth/password/reset-confirm", {
      method: "POST",
      body: JSON.stringify({
        identifier: testPhone,
        otp,
        newPassword: "BrandNewSecurePassword2026!",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res2 = await handleResetConfirm(req2);
    const data2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(data2.success).toBe(true);
    expect(data2.message).toContain("successful");
  });

  it("rejects confirmation if OTP is invalid", async () => {
    const req = new NextRequest("http://localhost/api/v1/auth/password/reset-confirm", {
      method: "POST",
      body: JSON.stringify({
        identifier: testPhone,
        otp: "000000",
        newPassword: "BrandNewSecurePassword2026!",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await handleResetConfirm(req);
    expect(res.status).toBe(400);
  });

  it("rejects confirmation if password is shorter than 8 characters", async () => {
    const req = new NextRequest("http://localhost/api/v1/auth/password/reset-confirm", {
      method: "POST",
      body: JSON.stringify({
        identifier: testPhone,
        otp: "123456",
        newPassword: "short",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await handleResetConfirm(req);
    expect(res.status).toBe(400);
  });
});

