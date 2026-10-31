import { describe, it, expect, beforeEach } from "vitest";
import { GET as handleGoogleInit } from "../route";
import { GET as handleGoogleConfig } from "../config/route";
import { NextRequest } from "next/server";

describe("Google OAuth Fast Path & Configuration", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id-12345.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret-12345";
  });

  it("GET /api/v1/auth/google responds with immediate 302 redirect to accounts.google.com", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/google?redirect=/account");
    const res = await handleGoogleInit(req);

    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toBeDefined();
    expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location).toContain("client_id=test-google-client-id-12345.apps.googleusercontent.com");
    expect(location).toContain("prompt=select_account");
    expect(location).toContain("response_type=code");
  });

  it("GET /api/v1/auth/google/config returns enabled config with cache headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/google/config");
    const res = await handleGoogleConfig(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(true);
    expect(data.client_id).toBe("test-google-client-id-12345.apps.googleusercontent.com");
    expect(res.headers.get("cache-control")).toContain("public");
  });
});

