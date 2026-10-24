import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { staffAuthService } from "@/modules/identity";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const POST = withRoute(
  {
    auth: "staff",
    permission: "staff.manage",
    params: paramsSchema,
  },
  async ({ actor, params }) => {
    const revokedCount = await staffAuthService.revokeAllStaffSessions(
      params.id,
      actor!.id
    );

    return new Response(
      JSON.stringify({
        success: true,
        revoked_count: revokedCount,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }
);
