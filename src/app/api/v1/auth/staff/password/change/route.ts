import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { staffAuthService } from "@/modules/identity";

const changePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(8),
});

export const POST = withRoute(
  {
    auth: "staff",
    body: changePasswordSchema,
  },
  async ({ actor, body }) => {
    await staffAuthService.changePassword(
      actor!.id,
      body.old_password,
      body.new_password,
      actor!.sessionId
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password updated successfully",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }
);
