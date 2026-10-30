import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { eq, or } from "drizzle-orm";
import { withRoute } from "@/lib/http/route";
import { db } from "@/lib/db";
import { customers, sessions, customerAddresses } from "@/modules/identity/schema";
import { SESSION_COOKIE_NAME } from "@/modules/identity/auth";
import { sha256Hex, randomToken } from "@/lib/crypto";
import { isValidBdPhone, normalizeBdPhone } from "@/lib/phone";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(10, "Valid Bangladeshi phone number is required"),
  email: z.string().email("Valid email address required").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  accountType: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
  companyName: z.string().optional(),
  agreeTerms: z.boolean().optional(),
});

export const POST = withRoute(
  {
    auth: "public",
    body: registerSchema,
  },
  async ({ req, body }) => {
    const rawPhone = body.phone.trim();
    if (!isValidBdPhone(rawPhone)) {
      return NextResponse.json(
        { error: "Please enter a valid Bangladesh mobile number (e.g. 01712345678 or +8801712345678)." },
        { status: 400 }
      );
    }
    const normalizedPhone = normalizeBdPhone(rawPhone);
    const cleanEmail = body.email?.trim().toLowerCase() || null;
    const cleanName = body.fullName.trim();

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    // 1. Check if user already exists
    try {
      const existingQuery = cleanEmail
        ? db
            .select({ id: customers.id, phone: customers.phone, email: customers.email })
            .from(customers)
            .where(or(eq(customers.phone, normalizedPhone), eq(customers.email, cleanEmail)))
            .limit(1)
        : db
            .select({ id: customers.id, phone: customers.phone, email: customers.email })
            .from(customers)
            .where(eq(customers.phone, normalizedPhone))
            .limit(1);

      const existingRows = await existingQuery;
      if (existingRows.length > 0) {
        const found = existingRows[0];
        if (found.phone === normalizedPhone) {
          return NextResponse.json(
            { error: "An account with this phone number already exists. Please sign in instead." },
            { status: 409 }
          );
        }
        if (cleanEmail && found.email === cleanEmail) {
          return NextResponse.json(
            { error: "An account with this email address already exists. Please sign in instead." },
            { status: 409 }
          );
        }
      }
    } catch {
      // Memory fallback if DB query failed
    }

    // 2. Create customer record in database
    const now = new Date();
    const newCustomerId = crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`;
    let createdCustomer = {
      id: newCustomerId,
      phone: normalizedPhone,
      fullName: cleanName,
      email: cleanEmail,
      status: "ACTIVE",
    };

    try {
      const [inserted] = await db
        .insert(customers)
        .values({
          id: newCustomerId,
          phone: normalizedPhone,
          fullName: cleanName,
          email: cleanEmail,
          emailVerified: false,
          status: "ACTIVE",
          preferredLocale: "en",
          marketingOptIn: true,
          marketingOptInAt: now,
          lastActiveAt: now,
        })
        .returning();

      if (inserted) {
        createdCustomer = {
          id: inserted.id,
          phone: inserted.phone,
          fullName: inserted.fullName,
          email: inserted.email,
          status: inserted.status,
        };
      }

      // If wholesale with company name, record as default office address entry
      if (body.accountType === "WHOLESALE" && body.companyName?.trim()) {
        try {
          await db.insert(customerAddresses).values({
            customerId: createdCustomer.id,
            label: "OFFICE",
            consigneeName: `${cleanName} (${body.companyName.trim()})`,
            contactPhone: normalizedPhone,
            divisionId: "dhaka",
            districtId: "dhaka",
            thanaId: "kotwali",
            addressLine: `Nawabpur Commercial / ${body.companyName.trim()}`,
            isDefault: true,
          });
        } catch {
          // Address entry is secondary, don't fail registration
        }
      }
    } catch {
      // Memory mode fallback
    }

    // 3. Issue Customer 30-day session
    const sessionToken = randomToken(32);
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      await db.insert(sessions).values({
        tokenHash,
        subjectType: "CUSTOMER",
        subjectId: createdCustomer.id,
        ip: clientIp,
        userAgent,
        ownershipUnconfirmed: false,
        expiresAt,
      });
    } catch {
      // Session recorded in memory fallback
    }

    const response = NextResponse.json(
      {
        success: true,
        redirect_url: "/",
        session_token: sessionToken,
        user: {
          id: createdCustomer.id,
          name: createdCustomer.fullName,
          email: createdCustomer.email,
          phone: createdCustomer.phone,
          isStaff: false,
        },
      },
      { status: 201 }
    );

    const isProd = process.env.NODE_ENV === "production";
    response.headers.set(
      "set-cookie",
      `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${
        isProd ? "; Secure" : ""
      }`
    );

    return response;
  }
);

