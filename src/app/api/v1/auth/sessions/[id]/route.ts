import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { authService } from "@/modules/identity";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const DELETE = withRoute(
  {
    auth: "customer",
    params: paramsSchema,
  },
  async ({ actor, params }) => {
    await authService.revokeSession(params.id, actor?.id);

    return new Response(JSON.stringify({ success: true, message: "Session revoked" }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }
);
