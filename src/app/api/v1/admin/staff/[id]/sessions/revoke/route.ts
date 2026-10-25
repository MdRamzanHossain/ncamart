import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { staffAuthService } from "@/modules/identity/staffAuth";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    const revokedCount = await staffAuthService.revokeAllStaffSessions(params.id, actor!.id);
    return NextResponse.json(
      {
        message: "All active sessions revoked for staff member",
        revoked_count: revokedCount,
      },
      { status: 200 }
    );
  }
);
