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
    const result = await staffAuthService.resetStaffPassword(params.id, actor!);
    return NextResponse.json(
      {
        message: "Password reset successful. Staff must change password upon next login.",
        one_time_password: result.temporaryPassword,
        must_change_password: true,
      },
      { status: 200 }
    );
  }
);
