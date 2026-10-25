import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { staffAuthService } from "@/modules/identity/staffAuth";
import { STAFF_ROLES } from "@/modules/identity/permissions";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateStaffSchema = z.object({
  full_name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(11).optional(),
  roles: z.array(z.enum(STAFF_ROLES)).min(1).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    params: paramsSchema,
  },
  async ({ params }) => {
    const staff = await staffAuthService.getStaffById(params.id);
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    return NextResponse.json(staff, { status: 200 });
  }
);

export const PUT = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    params: paramsSchema,
    body: updateStaffSchema,
  },
  async ({ params, body, actor }) => {
    const updated = await staffAuthService.updateStaff(
      params.id,
      {
        fullName: body.full_name,
        email: body.email,
        phone: body.phone,
        roles: body.roles,
        status: body.status,
      },
      actor!
    );

    return NextResponse.json(updated, { status: 200 });
  }
);
