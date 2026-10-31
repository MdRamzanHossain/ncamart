import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { db } from "@/lib/db";
import { customers } from "@/modules/identity/schema";
import { staffAuthService } from "@/modules/identity/staffAuth";
import { desc } from "drizzle-orm";
import { normalizeBdPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export interface UnifiedUserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "STAFF" | "CUSTOMER";
  roles: string[];
  status: "ACTIVE" | "SUSPENDED" | "FROZEN" | "ANONYMIZED";
  twoFactorEnabled: boolean;
  authProvider: "GOOGLE" | "PHONE_OTP" | "CREDENTIALS";
  createdAt: string;
  lastLoginAt: string | null;
}

const querySchema = z.object({
  search: z.string().optional(),
  type: z.enum(["ALL", "STAFF", "CUSTOMER"]).optional().default("ALL"),
  role: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const createUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  roles: z.array(z.string()).min(1),
  status: z.enum(["ACTIVE", "SUSPENDED"]).default("ACTIVE"),
  password: z.string().min(8).optional(),
});

export const GET = withRoute(
  {
    auth: "staff",
    query: querySchema,
  },
  async ({ query }) => {
    const unifiedUsers: UnifiedUserDto[] = [];
    const searchFilter = query.search?.trim().toLowerCase() || "";

    // 1. Fetch Staff Accounts
    try {
      const staffList = await staffAuthService.listStaff({ limit: 100 });
      const staffMembers = (staffList as any).data || (staffList as any).staff || [];
      for (const s of staffMembers) {
        unifiedUsers.push({
          id: s.id,
          name: s.full_name,
          email: s.email,
          phone: s.phone,
          type: "STAFF",
          roles: s.roles && s.roles.length > 0 ? s.roles : ["STAFF"],
          status: s.status as any,
          twoFactorEnabled: s.totp_enabled,
          authProvider: s.email?.includes("@gmail.com") ? "GOOGLE" : "CREDENTIALS",
          createdAt: s.created_at,
          lastLoginAt: s.last_login_at || null,
        });
      }
    } catch (err) {
      console.error("[GET /api/v1/admin/users] Error listing staff:", err);
    }

    // 2. Fetch Customer Accounts
    try {
      const customerRows = await db
        .select()
        .from(customers)
        .orderBy(desc(customers.createdAt))
        .limit(query.limit);

      for (const c of customerRows) {
        // Skip if customer email or phone is already represented as staff
        const alreadyRepresented = unifiedUsers.some(
          (u) =>
            u.type === "STAFF" &&
            ((c.email && u.email.toLowerCase() === c.email.toLowerCase()) ||
              (c.phone && u.phone === c.phone))
        );
        if (alreadyRepresented) {
          continue;
        }

        const isGoogle = Boolean(c.email && (c.email.includes("@gmail.com") || c.phone.startsWith("+88019999")));
        const isPhoneOtp = Boolean(c.phone && !c.email);

        unifiedUsers.push({
          id: c.id,
          name: c.fullName || "Registered Customer",
          email: c.email || "",
          phone: c.phone,
          type: "CUSTOMER",
          roles: ["CUSTOMER"],
          status: c.status as any,
          twoFactorEnabled: false,
          authProvider: isGoogle ? "GOOGLE" : isPhoneOtp ? "PHONE_OTP" : "CREDENTIALS",
          createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
          lastLoginAt: c.lastActiveAt ? new Date(c.lastActiveAt).toISOString() : null,
        });
      }
    } catch (err) {
      console.error("[GET /api/v1/admin/users] Error listing customers:", err);
    }

    // 3. Apply in-memory search and filters
    let filtered = unifiedUsers;

    if (query.type === "STAFF") {
      filtered = filtered.filter((u) => u.type === "STAFF");
    } else if (query.type === "CUSTOMER") {
      filtered = filtered.filter((u) => u.type === "CUSTOMER");
    }

    if (query.status && query.status !== "ALL") {
      filtered = filtered.filter((u) => u.status === query.status);
    }

    if (query.role && query.role !== "ALL") {
      filtered = filtered.filter((u) => u.roles.includes(query.role!));
    }

    if (searchFilter) {
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(searchFilter) ||
          u.email.toLowerCase().includes(searchFilter) ||
          u.phone.includes(searchFilter) ||
          u.roles.some((r) => r.toLowerCase().includes(searchFilter))
      );
    }

    return NextResponse.json(
      {
        users: filtered,
        total: filtered.length,
        page: query.page,
        limit: query.limit,
      },
      { status: 200 }
    );
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    body: createUserSchema,
  },
  async ({ body, actor }) => {
    const isStaffRole = body.roles.some((r) => r !== "CUSTOMER");
    const normalizedPhone = normalizeBdPhone(body.phone);
    const normalizedEmail = body.email.trim().toLowerCase();

    if (isStaffRole) {
      // Create Staff Member
      const staffRolesInput = body.roles.filter((r) => STAFF_ROLES.includes(r as any)) as StaffRole[];
      const assignedRoles = staffRolesInput.length > 0 ? staffRolesInput : (["OPS_MANAGER"] as StaffRole[]);
      const initialPassword = body.password || `Nca#${Math.random().toString(36).slice(2, 10)}!1A`;

      const result = await staffAuthService.createStaff({
        fullName: body.fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        roles: assignedRoles,
        password: initialPassword,
        mustChangePassword: true,
      });

      const userDto: UnifiedUserDto = {
        id: result.staff.id,
        name: result.staff.fullName,
        email: result.staff.email,
        phone: result.staff.phone,
        type: "STAFF",
        roles: assignedRoles,
        status: result.staff.status as any,
        twoFactorEnabled: false,
        authProvider: normalizedEmail.includes("@gmail.com") ? "GOOGLE" : "CREDENTIALS",
        createdAt: result.staff.createdAt.toISOString(),
        lastLoginAt: null,
      };

      return NextResponse.json(
        {
          user: userDto,
          initial_password: result.initialPassword,
        },
        { status: 201 }
      );
    } else {
      // Create Customer Account
      const [newCustomer] = await db
        .insert(customers)
        .values({
          fullName: body.fullName,
          email: normalizedEmail,
          phone: normalizedPhone,
          status: body.status === "SUSPENDED" ? "FROZEN" : "ACTIVE",
          emailVerified: true,
        })
        .returning();

      const userDto: UnifiedUserDto = {
        id: newCustomer.id,
        name: newCustomer.fullName || "Customer",
        email: newCustomer.email || normalizedEmail,
        phone: newCustomer.phone,
        type: "CUSTOMER",
        roles: ["CUSTOMER"],
        status: newCustomer.status as any,
        twoFactorEnabled: false,
        authProvider: normalizedEmail.includes("@gmail.com") ? "GOOGLE" : "CREDENTIALS",
        createdAt: newCustomer.createdAt.toISOString(),
        lastLoginAt: null,
      };

      return NextResponse.json({ user: userDto }, { status: 201 });
    }
  }
);

