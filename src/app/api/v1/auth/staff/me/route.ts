import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { staffAuthService } from "@/modules/identity/staffAuth";

const updateSelfSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("totp_init"),
  }),
  z.object({
    action: z.literal("totp_confirm"),
    totp_code: z.string().min(6).max(8),
  }),
  z.object({
    action: z.literal("totp_disable"),
    password: z.string().min(1),
  }),
  z.object({
    action: z.literal("change_password"),
    old_password: z.string().min(1),
    new_password: z.string().min(8),
  }),
  z.object({
    action: z.literal("revoke_other_sessions"),
  }),
]);

export const GET = withRoute(
  {
    auth: "staff",
  },
  async ({ actor }) => {
    const data = await staffAuthService.getSelfProfile(actor!.id, actor!.sessionId);
    return NextResponse.json(data, { status: 200 });
  }
);

export const PATCH = withRoute(
  {
    auth: "staff",
    body: updateSelfSchema,
  },
  async ({ actor, body }) => {
    const updated = await staffAuthService.updateSelfProfile(actor!.id, {
      fullName: body.full_name,
      email: body.email,
      phone: body.phone,
    });
    return NextResponse.json({ staff: updated }, { status: 200 });
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    body: actionSchema,
  },
  async ({ actor, body }) => {
    switch (body.action) {
      case "totp_init": {
        const res = await staffAuthService.initSelfTotpEnrollment(actor!.id);
        return NextResponse.json(res, { status: 200 });
      }
      case "totp_confirm": {
        const res = await staffAuthService.confirmSelfTotpEnrollment(actor!.id, body.totp_code);
        return NextResponse.json(res, { status: 200 });
      }
      case "totp_disable": {
        const res = await staffAuthService.disableSelfTotp(actor!.id, body.password);
        return NextResponse.json(res, { status: 200 });
      }
      case "change_password": {
        await staffAuthService.changePassword(
          actor!.id,
          body.old_password,
          body.new_password,
          actor!.sessionId
        );
        return NextResponse.json(
          { success: true, message: "Password updated successfully." },
          { status: 200 }
        );
      }
      case "revoke_other_sessions": {
        const count = await staffAuthService.revokeOtherStaffSessions(
          actor!.id,
          actor!.sessionId
        );
        return NextResponse.json(
          {
            success: true,
            revoked_count: count,
            message: `Revoked ${count} other active session(s).`,
          },
          { status: 200 }
        );
      }
    }
  }
);

