import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { staffAuthService } from "@/modules/identity/staffAuth";
import { STAFF_ROLES } from "@/modules/identity/permissions";

const querySchema = z.object({
  role: z.enum(STAFF_ROLES).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const createStaffSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(11),
  roles: z.array(z.enum(STAFF_ROLES)).min(1),
  password: z.string().min(8).optional(),
  must_change_password: z.boolean().default(true),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    query: querySchema,
  },
  async ({ query }) => {
    const result = await staffAuthService.listStaff(query);
    return NextResponse.json(result, { status: 200 });
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    body: createStaffSchema,
  },
  async ({ body, actor }) => {
    const initialPassword = body.password || `Nca#${Math.random().toString(36).slice(2, 10)}!1A`;
    const result = await staffAuthService.createStaff({
      fullName: body.full_name,
      email: body.email,
      phone: body.phone,
      roles: body.roles,
      password: initialPassword,
      mustChangePassword: body.must_change_password,
    });

    return NextResponse.json(
      {
        staff: {
          id: result.staff.id,
          full_name: result.staff.fullName,
          email: result.staff.email,
          phone: result.staff.phone,
          status: result.staff.status,
          roles: body.roles,
          must_change_password: result.staff.mustChangePassword,
          created_at: result.staff.createdAt,
        },
        initial_password: result.initialPassword,
      },
      { status: 201 }
    );
  }
);
