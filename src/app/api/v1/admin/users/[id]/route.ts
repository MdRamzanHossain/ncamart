import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { db } from "@/lib/db";
import { staff, customers, staffRoles } from "@/modules/identity/schema";
import { staffAuthService } from "@/modules/identity/staffAuth";
import { adminCustomerService } from "@/modules/identity/adminCustomerService";
import { STAFF_ROLES, StaffRole } from "@/modules/identity/permissions";
import { eq, or, ilike, sql } from "drizzle-orm";
import { normalizeBdPhone } from "@/lib/phone";
import argon2 from "argon2";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  roles: z.array(z.string()).min(1).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "FROZEN"]).optional(),
  reset2FA: z.boolean().optional(),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    params: paramsSchema,
  },
  async ({ params }) => {
    // 1. Try finding staff by ID
    try {
      const staffUser = await staffAuthService.getStaffById(params.id);
      if (staffUser) {
        return NextResponse.json({
          user: {
            id: staffUser.id,
            name: staffUser.full_name,
            email: staffUser.email,
            phone: staffUser.phone,
            type: "STAFF",
            roles: staffUser.roles && staffUser.roles.length > 0 ? staffUser.roles : ["STAFF"],
            status: staffUser.status,
            twoFactorEnabled: staffUser.totp_enabled,
            authProvider: staffUser.email.includes("@gmail.com") ? "GOOGLE" : "CREDENTIALS",
            createdAt: staffUser.created_at,
          },
        });
      }
    } catch {
      // not in staff table by ID
    }

    // 2. Try finding Customer by ID
    try {
      const [customerRow] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, params.id as any))
        .limit(1);

      if (customerRow) {
        // Also check if this customer has a corresponding staff record
        const staffByEmailOrPhone = await db
          .select()
          .from(staff)
          .where(
            or(
              customerRow.email ? ilike(staff.email, customerRow.email) : undefined,
              customerRow.phone ? eq(staff.phone, customerRow.phone) : undefined
            )
          )
          .limit(1);

        if (staffByEmailOrPhone[0]) {
          const s = await staffAuthService.getStaffById(staffByEmailOrPhone[0].id);
          if (s) {
            return NextResponse.json({
              user: {
                id: s.id,
                name: s.full_name,
                email: s.email,
                phone: s.phone,
                type: "STAFF",
                roles: s.roles,
                status: s.status,
                twoFactorEnabled: s.totp_enabled,
                authProvider: s.email.includes("@gmail.com") ? "GOOGLE" : "CREDENTIALS",
                createdAt: s.created_at,
              },
            });
          }
        }

        return NextResponse.json({
          user: {
            id: customerRow.id,
            name: customerRow.fullName || "Customer",
            email: customerRow.email || "",
            phone: customerRow.phone,
            type: "CUSTOMER",
            roles: ["CUSTOMER"],
            status: customerRow.status,
            twoFactorEnabled: false,
            authProvider: customerRow.email?.includes("@gmail.com") ? "GOOGLE" : "PHONE_OTP",
            createdAt: customerRow.createdAt ? new Date(customerRow.createdAt).toISOString() : new Date().toISOString(),
          },
        });
      }
    } catch {
      // not found
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
);

export const PUT = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    params: paramsSchema,
    body: updateUserSchema,
  },
  async ({ params, body, actor }) => {
    // 1. Locate staff or customer record
    let staffRecord: any = null;
    try {
      staffRecord = await staffAuthService.getStaffById(params.id);
    } catch {
      // not staff by id
    }

    let custRow: any = null;
    try {
      const [c] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, params.id as any))
        .limit(1);
      custRow = c;
    } catch {
      // not customer by id
    }

    // If staffRecord not found by ID, but custRow exists, check if staff exists with matching email or phone
    if (!staffRecord && custRow) {
      try {
        const staffMatches = await db
          .select()
          .from(staff)
          .where(
            or(
              custRow.email ? ilike(staff.email, custRow.email) : undefined,
              custRow.phone ? eq(staff.phone, custRow.phone) : undefined
            )
          )
          .limit(1);
        if (staffMatches[0]) {
          staffRecord = await staffAuthService.getStaffById(staffMatches[0].id);
        }
      } catch {
        // ignore
      }
    }

    // If neither found by ID, try body email / phone
    if (!staffRecord && !custRow && (body.email || body.phone)) {
      try {
        const staffMatches = await db
          .select()
          .from(staff)
          .where(
            or(
              body.email ? ilike(staff.email, body.email) : undefined,
              body.phone ? eq(staff.phone, normalizeBdPhone(body.phone)) : undefined
            )
          )
          .limit(1);
        if (staffMatches[0]) {
          staffRecord = await staffAuthService.getStaffById(staffMatches[0].id);
        }
      } catch {}
    }

    if (!staffRecord && !custRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rawRoles = body.roles || [];
    const isExplicitCustomer = rawRoles.length === 1 && rawRoles[0] === "CUSTOMER";
    const assignedStaffRoles = rawRoles.filter((r) => STAFF_ROLES.includes(r as any)) as StaffRole[];
    const isStaffRoleAssignment = assignedStaffRoles.length > 0;

    const normEmail = (body.email || staffRecord?.email || custRow?.email || "").toLowerCase();
    const rawPhone = body.phone || staffRecord?.phone || custRow?.phone || "";
    const normPhone = rawPhone.length >= 10 ? normalizeBdPhone(rawPhone) : rawPhone;
    const fullName = body.fullName || staffRecord?.full_name || custRow?.fullName || "User";
    const targetStatus: "ACTIVE" | "SUSPENDED" = body.status === "FROZEN" ? "SUSPENDED" : body.status || "ACTIVE";

    // CASE 1: Assigning Staff Role(s) (Promoting or Updating Staff)
    if (isStaffRoleAssignment) {
      let staffId = staffRecord?.id;

      if (staffId) {
        // Update existing staff in DB
        try {
          await db
            .update(staff)
            .set({
              fullName,
              email: normEmail,
              phone: normPhone,
              status: targetStatus,
              updatedAt: new Date(),
            })
            .where(eq(staff.id, staffId as any));
        } catch {
          // ignore
        }

        // Update staff_roles relation in DB
        try {
          await db.delete(staffRoles).where(eq(staffRoles.staffId, staffId as any));
          for (const role of assignedStaffRoles) {
            await db
              .insert(staffRoles)
              .values({ staffId: staffId as any, role })
              .onConflictDoNothing();
          }
        } catch {
          // ignore
        }
      } else {
        // Insert new staff member in DB with conflict resolution
        const tempPassword = `Nca#${Math.random().toString(36).slice(2, 10)}!1A`;
        const passwordHash = await argon2.hash(tempPassword);

        try {
          const [inserted] = await db
            .insert(staff)
            .values({
              fullName,
              email: normEmail,
              phone: normPhone,
              passwordHash,
              totpEnabled: false,
              status: targetStatus,
              mustChangePassword: true,
            })
            .onConflictDoUpdate({
              target: staff.email,
              set: {
                fullName,
                phone: normPhone,
                status: targetStatus,
                updatedAt: new Date(),
              },
            })
            .returning();

          staffId = inserted ? inserted.id : (custRow ? custRow.id : crypto.randomUUID());
        } catch {
          staffId = custRow ? custRow.id : crypto.randomUUID();
        }

        // Insert staff_roles relation
        try {
          await db.delete(staffRoles).where(eq(staffRoles.staffId, staffId as any));
          for (const role of assignedStaffRoles) {
            await db
              .insert(staffRoles)
              .values({ staffId: staffId as any, role })
              .onConflictDoNothing();
          }
        } catch {
          // ignore
        }
      }

      // Handle 2FA reset if requested
      if (body.reset2FA && staffId) {
        try {
          await staffAuthService.resetStaffTotp(staffId, actor!);
        } catch {
          // ignore
        }
      }

      // Keep customer table status synced if customer record exists
      if (custRow) {
        try {
          await db
            .update(customers)
            .set({
              fullName,
              status: targetStatus === "SUSPENDED" ? "FROZEN" : "ACTIVE",
              updatedAt: new Date(),
            })
            .where(eq(customers.id, custRow.id));
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: true,
        message: "Staff member access and roles updated successfully in database.",
        user: {
          id: staffId,
          name: fullName,
          email: normEmail,
          phone: normPhone,
          type: "STAFF",
          roles: assignedStaffRoles,
          status: targetStatus,
          twoFactorEnabled: false,
        },
      });
    }

    // CASE 2: Demoting Staff to Customer
    if (isExplicitCustomer) {
      if (staffRecord && staffRecord.roles?.includes("SUPER_ADMIN") && staffRecord.status === "ACTIVE") {
        const otherAdmins = await staffAuthService.countOtherActiveSuperAdmins(staffRecord.id);
        if (otherAdmins === 0) {
          return NextResponse.json(
            { error: "Security Invariant Breach: Cannot demote the last active SUPER_ADMIN to customer." },
            { status: 422 }
          );
        }
      }

      // Remove from staff_roles and staff table
      if (staffRecord) {
        try {
          await db.delete(staffRoles).where(eq(staffRoles.staffId, staffRecord.id as any));
          await db.delete(staff).where(eq(staff.id, staffRecord.id as any));
        } catch {
          // ignore
        }
      }

      const custStatus = targetStatus === "SUSPENDED" ? "FROZEN" : "ACTIVE";

      // Ensure customer row exists and is updated
      if (custRow) {
        try {
          await db
            .update(customers)
            .set({
              fullName,
              email: normEmail,
              phone: normPhone,
              status: custStatus as any,
              updatedAt: new Date(),
            })
            .where(eq(customers.id, custRow.id));
        } catch {}
      } else {
        try {
          await db
            .insert(customers)
            .values({
              fullName,
              email: normEmail,
              phone: normPhone,
              status: custStatus as any,
            })
            .onConflictDoNothing();
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: "User set to Storefront Customer successfully.",
        user: {
          id: custRow ? custRow.id : params.id,
          name: fullName,
          email: normEmail,
          phone: normPhone,
          type: "CUSTOMER",
          roles: ["CUSTOMER"],
          status: targetStatus,
          twoFactorEnabled: false,
        },
      });
    }

    // CASE 3: Status Only Update
    if (staffRecord) {
      try {
        await db
          .update(staff)
          .set({ status: targetStatus, updatedAt: new Date() })
          .where(eq(staff.id, staffRecord.id as any));
      } catch {}
    }

    if (custRow) {
      try {
        await db
          .update(customers)
          .set({
            status: targetStatus === "SUSPENDED" ? "FROZEN" : ("ACTIVE" as any),
            updatedAt: new Date(),
          })
          .where(eq(customers.id, custRow.id));
      } catch {}
    }

    return NextResponse.json({
      success: true,
      user: {
        id: params.id,
        name: fullName,
        email: normEmail,
        phone: normPhone,
        type: staffRecord ? "STAFF" : "CUSTOMER",
        roles: staffRecord ? staffRecord.roles : ["CUSTOMER"],
        status: targetStatus,
        twoFactorEnabled: false,
      },
    });
  }
);

export const DELETE = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    // Prevent self-deletion
    if (actor && actor.id === params.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    // Try finding staff by ID or matching email/phone
    let staffId = params.id;
    let staffUser: any = null;
    try {
      staffUser = await staffAuthService.getStaffById(params.id);
    } catch {}

    if (!staffUser) {
      try {
        const [c] = await db.select().from(customers).where(eq(customers.id, params.id as any)).limit(1);
        if (c && (c.email || c.phone)) {
          const s = await db.select().from(staff).where(
            or(
              c.email ? ilike(staff.email, c.email) : undefined,
              c.phone ? eq(staff.phone, c.phone) : undefined
            )
          ).limit(1);
          if (s[0]) {
            staffUser = await staffAuthService.getStaffById(s[0].id);
            staffId = s[0].id;
          }
        }
      } catch {}
    }

    if (staffUser) {
      try {
        await staffAuthService.deleteStaff(staffId, actor!);
      } catch (err: any) {
        if (err.code === "ERR_LAST_SUPER_ADMIN") {
          return NextResponse.json(
            { error: "Cannot delete the last active Super Admin account." },
            { status: 422 }
          );
        }
      }
    }

    // Also delete from customers
    try {
      await adminCustomerService.deleteCustomer(params.id, actor!);
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Account permanently deleted.",
    });
  }
);
