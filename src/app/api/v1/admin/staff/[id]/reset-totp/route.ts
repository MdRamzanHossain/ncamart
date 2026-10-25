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
    const result = await staffAuthService.resetStaffTotp(params.id, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
