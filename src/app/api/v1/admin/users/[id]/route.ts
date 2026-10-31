import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { db } from "@/lib/db";
import { staff, customers, staffRoles, sessions } from "@/modules/identity/schema";
import { staffAuthService } from "@/modules/identity/staffAuth";
import { adminCustomerService } from "@/modules/identity/adminCustomerService";
import { STAFF_ROLES, StaffRole } from "@/modules/identity/permissions";
import { eq, or, ilike, sql } from "drizzle-orm";
import { normalizeBdPhone } from "@/lib/phone";
import { sha256Hex } from "@/lib/crypto";

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
    // 1. Check Staff
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
            roles: staffUser.roles,
            status: staffUser.status,
            twoFactorEnabled: staffUser.totp_enabled,
            authProvider: staffUser.email.includes("@gmail.com") ? "GOOGLE" : "CREDENTIALS",
            createdAt: staffUser.created_at,
          },
        });
      }
    } catch {
      // Check customer
    }

    // 2. Check Customer
    try {
      const [customerRow] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, params.id as any))
        .limit(1);

      if (customerRow) {
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
            createdAt: customerRow.createdAt.toISOString(),
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
    // Check if user is staff
    let staffRecord = null;
    try {
      staffRecord = await staffAuthService.getStaffById(params.id);
    } catch {
      // Not staff
    }

    if (staffRecord) {
      // Check if roles demote staff to regular customer
      const onlyCustomerRole = body.roles && body.roles.length === 1 && body.roles[0] === "CUSTOMER";
      if (onlyCustomerRole) {
        // Demote staff to customer
        await staffAuthService.deleteStaff(params.id, actor!);

        // Ensure customer row exists
        const normPhone = normalizeBdPhone(body.phone || staffRecord.phone);
        const normEmail = (body.email || staffRecord.email).toLowerCase();

        await db
          .insert(customers)
          .values({
            fullName: body.fullName || staffRecord.full_name,
            email: normEmail,
            phone: normPhone,
            status: "ACTIVE",
          })
          .onConflictDoNothing();

        return NextResponse.json({
          success: true,
          message: "Staff member demoted to regular customer.",
          user: {
            id: params.id,
            name: body.fullName || staffRecord.full_name,
            email: normEmail,
            phone: normPhone,
            type: "CUSTOMER",
            roles: ["CUSTOMER"],
            status: "ACTIVE",
            twoFactorEnabled: false,
          },
        });
      }

      // Update staff details & roles
      const filteredStaffRoles = body.roles
        ? (body.roles.filter((r) => STAFF_ROLES.includes(r as any)) as StaffRole[])
        : undefined;

      const updated = await staffAuthService.updateStaff(
        params.id,
        {
          fullName: body.fullName,
          email: body.email,
          phone: body.phone,
          roles: filteredStaffRoles && filteredStaffRoles.length > 0 ? filteredStaffRoles : undefined,
          status: body.status === "FROZEN" ? "SUSPENDED" : body.status,
        },
        actor!
      );

      // Handle 2FA reset if requested
      if (body.reset2FA) {
        try {
          await staffAuthService.resetStaffTotp(params.id, actor!);
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: true,
        user: {
          id: updated.id,
          name: updated.full_name,
          email: updated.email,
          phone: updated.phone,
          type: "STAFF",
          roles: updated.roles,
          status: updated.status,
          twoFactorEnabled: body.reset2FA ? false : updated.totp_enabled,
        },
      });
    }

    // User is a Customer in customers table
    const [custRow] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, params.id as any))
      .limit(1);

    if (!custRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if promoting customer to staff
    const assignedStaffRoles = body.roles
      ? (body.roles.filter((r) => STAFF_ROLES.includes(r as any)) as StaffRole[])
      : [];

    if (assignedStaffRoles.length > 0) {
      // Promote customer to staff
      const staffName = body.fullName || custRow.fullName || "Staff Member";
      const staffEmail = (body.email || custRow.email || `staff_${custRow.id.slice(0, 8)}@ncamart.com`).toLowerCase();
      const staffPhone = normalizeBdPhone(body.phone || custRow.phone);
      const tempPassword = `Nca#${Math.random().toString(36).slice(2, 10)}!1A`;

      const createdStaff = await staffAuthService.createStaff({
        fullName: staffName,
        email: staffEmail,
        phone: staffPhone,
        roles: assignedStaffRoles,
        password: tempPassword,
        mustChangePassword: true,
      });

      return NextResponse.json({
        success: true,
        message: "Customer promoted to staff member successfully.",
        initial_password: tempPassword,
        user: {
          id: createdStaff.staff.id,
          name: createdStaff.staff.fullName,
          email: createdStaff.staff.email,
          phone: createdStaff.staff.phone,
          type: "STAFF",
          roles: assignedStaffRoles,
          status: createdStaff.staff.status,
          twoFactorEnabled: false,
        },
      });
    }

    // Standard Customer Update
    const newStatus = body.status === "SUSPENDED" ? "FROZEN" : body.status || custRow.status;
    const [updatedCust] = await db
      .update(customers)
      .set({
        fullName: body.fullName || custRow.fullName,
        email: body.email ? body.email.toLowerCase() : custRow.email,
        phone: body.phone ? normalizeBdPhone(body.phone) : custRow.phone,
        status: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, custRow.id))
      .returning();

    return NextResponse.json({
      success: true,
      user: {
        id: updatedCust.id,
        name: updatedCust.fullName,
        email: updatedCust.email,
        phone: updatedCust.phone,
        type: "CUSTOMER",
        roles: ["CUSTOMER"],
        status: updatedCust.status,
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

    // Try deleting as staff first
    try {
      const staffUser = await staffAuthService.getStaffById(params.id);
      if (staffUser) {
        await staffAuthService.deleteStaff(params.id, actor!);
        return NextResponse.json({
          success: true,
          message: `Staff member ${staffUser.full_name} (${staffUser.email}) permanently deleted.`,
        });
      }
    } catch (err: any) {
      if (err.code === "ERR_LAST_SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Cannot delete the last active Super Admin account." },
          { status: 422 }
        );
      }
    }

    // Try deleting as customer
    try {
      await adminCustomerService.deleteCustomer(params.id, actor!);
      return NextResponse.json({
        success: true,
        message: "Customer account permanently deleted.",
      });
    } catch {
      // not found
    }

    return NextResponse.json({ error: "User account not found." }, { status: 404 });
  }
);

