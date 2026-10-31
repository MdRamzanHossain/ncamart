import { NextRequest, NextResponse } from "next/server";
import { settingsService } from "@/modules/settings";
import { db } from "@/lib/db";
import { staff, customers, sessions, CustomerRow } from "@/modules/identity/schema";
import { staffAuthService, STAFF_SESSION_COOKIE_NAME } from "@/modules/identity";
import { SESSION_COOKIE_NAME } from "@/modules/identity/auth";
import { eq, sql, ilike, or } from "drizzle-orm";
import { sha256Hex, randomToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin =
    req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host")}`
      : req.nextUrl.origin;

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const stateParam = searchParams.get("state");

  // 1. Direct Visit or Missing Code Safe Fallback (Fixes 404)
  if (!code) {
    if (errorParam) {
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(errorParam)}`, origin)
      );
    }
    // Visited directly without oauth code - redirect cleanly to login portal
    return NextResponse.redirect(
      new URL("/auth/login?info=google_oauth_ready", origin)
    );
  }

  // 2. Decode state for original target redirection
  let targetRedirect = "/";
  if (stateParam) {
    try {
      const decoded = JSON.parse(
        Buffer.from(stateParam, "base64url").toString("utf-8")
      );
      if (decoded.redirect && typeof decoded.redirect === "string") {
        targetRedirect = decoded.redirect;
      }
    } catch {
      // Safe fallback
    }
  }

  try {
    // 3. Fast path: Retrieve Google OAuth Credentials (check env first, then DB)
    let clientId =
      process.env.GOOGLE_CLIENT_ID?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
      "";
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
    let redirectUri = "";

    if (!clientId || !clientSecret) {
      try {
        const config = await settingsService.get("GOOGLE_AUTH_CONFIG");
        if (!clientId) clientId = config.clientId?.trim() || "";
        if (!clientSecret) clientSecret = config.clientSecret?.trim() || "";
        if (!redirectUri) redirectUri = config.redirectUri?.trim() || "";
      } catch {
        // DB settings fallback
      }
    }

    if (!redirectUri || !redirectUri.startsWith("http")) {
      redirectUri = `${origin}/api/v1/auth/google/callback`;
    }

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL(
          "/auth/login?error=google_credentials_missing_in_admin",
          origin
        )
      );
    }

    // 4. Exchange Authorization Code for Tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        new URL("/auth/login?error=google_token_exchange_failed", origin)
      );
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      id_token?: string;
    };

    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL("/auth/login?error=missing_google_access_token", origin)
      );
    }

    // 5. Fetch Verified Google User Profile
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (!profileResponse.ok) {
      return NextResponse.redirect(
        new URL("/auth/login?error=google_userinfo_failed", origin)
      );
    }

    const googleUser = (await profileResponse.json()) as {
      email?: string;
      name?: string;
      email_verified?: boolean;
      sub?: string;
    };

    if (!googleUser.email) {
      return NextResponse.redirect(
        new URL("/auth/login?error=no_email_provided_by_google", origin)
      );
    }

    const email = googleUser.email.trim().toLowerCase();
    const fullName = googleUser.name || "Google User";
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;
    const isProd = process.env.NODE_ENV === "production";

    // 6. Check if email belongs to a STAFF user (case-insensitive)
    let staffUser = null;
    try {
      const staffRows = await db
        .select()
        .from(staff)
        .where(
          or(
            ilike(staff.email, email),
            sql`LOWER(${staff.email}) = LOWER(${email})`
          )
        )
        .limit(1);
      staffUser = staffRows[0] ?? null;
    } catch {
      // Memory fallback
    }

    // Fallback: Check in-memory store or configured admin email
    if (!staffUser) {
      const configuredAdminEmail = (process.env.ADMIN_EMAIL || "admin@ncamart.com").trim().toLowerCase();
      if (email === configuredAdminEmail) {
        staffUser = {
          id: `staff_${sha256Hex(email).substring(0, 16)}`,
          fullName,
          email,
          phone: "+8801700000000",
          status: "ACTIVE",
          totpEnabled: false,
          totpSecretEnc: null,
          mustChangePassword: false,
        } as any;
      }
    }

    if (staffUser && staffUser.status === "ACTIVE") {
      // Staff account detected! Per requirement: 2FA is skipped when signing in with Google
      const sessionToken = randomToken(32);
      const tokenHash = sha256Hex(sessionToken);
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

      try {
        await db.insert(sessions).values({
          tokenHash,
          subjectType: "STAFF",
          subjectId: staffUser.id,
          ip: clientIp,
          userAgent,
          ownershipUnconfirmed: false,
          expiresAt,
        });
      } catch {
        // DB insert fallback
      }
      staffAuthService.setMemoryStaffSession(sessionToken, staffUser.id);

      // Resolve roles for client hydration
      const roles = await staffAuthService.getStaffRoles(staffUser.id);
      const primaryRole = roles.includes("SUPER_ADMIN")
        ? "SUPER_ADMIN"
        : roles[0] || "STAFF";

      const staffSyncData = JSON.stringify({
        id: staffUser.id,
        name: staffUser.fullName,
        email: staffUser.email,
        phone: staffUser.phone,
        role: primaryRole,
        roles,
        isStaff: true,
      });

      const response = NextResponse.redirect(new URL("/admin?google_auth_success=1", origin));
      response.cookies.set(STAFF_SESSION_COOKIE_NAME, sessionToken, {
        path: "/",
        maxAge: 43200,
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
      });
      // Client-readable cookie so AdminShell can immediately hydrate localStorage without redirects
      response.cookies.set("nca_auth_sync", encodeURIComponent(staffSyncData), {
        path: "/",
        maxAge: 180,
        httpOnly: false,
        sameSite: "lax",
        secure: isProd,
      });
      return response;
    }

    // 7. Customer Flow (General User)
    let customer: CustomerRow | null = null;
    try {
      const customerRows = await db
        .select()
        .from(customers)
        .where(eq(customers.email, email))
        .limit(1);
      customer = customerRows[0] ?? null;
    } catch {
      // fallback
    }

    const now = new Date();
    if (!customer) {
      const fakePhone = `+88019${Math.floor(10000000 + Math.random() * 90000000)}`;
      try {
        const [created] = await db
          .insert(customers)
          .values({
            email,
            fullName,
            phone: fakePhone,
            emailVerified: true,
            status: "ACTIVE",
            preferredLocale: "bn",
            lastActiveAt: now,
          })
          .returning();
        customer = created;
      } catch {
        customer = {
          id: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
          email,
          fullName,
          phone: fakePhone,
          emailVerified: true,
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
      }
    } else {
      try {
        await db
          .update(customers)
          .set({ lastActiveAt: now, emailVerified: true })
          .where(eq(customers.id, customer.id));
      } catch {
        // ignore
      }
    }

    // Issue 30-Day Customer Session
    const sessionToken = randomToken(32);
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      await db.insert(sessions).values({
        tokenHash,
        subjectType: "CUSTOMER",
        subjectId: customer.id,
        ip: clientIp,
        userAgent,
        ownershipUnconfirmed: false,
        expiresAt,
      });
    } catch {
      // session fallback
    }

    // If destination was /admin, customer must redirect to storefront root /
    let safeDestination = targetRedirect;
    if (!safeDestination || safeDestination.startsWith("/admin")) {
      safeDestination = "/";
    }

    const response = NextResponse.redirect(new URL(safeDestination, origin));
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      path: "/",
      maxAge: 2592000,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    });
    return response;
  } catch (err) {
    const msg = err instanceof Error ? encodeURIComponent(err.message) : "oauth_error";
    return NextResponse.redirect(new URL(`/auth/login?error=${msg}`, origin));
  }
}
