import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { authService } from "@/modules/identity";
import { UnauthenticatedError } from "@/lib/errors";

const bodySchema = z.object({
  new_phone: z.string().min(10).max(16),
  otp_code: z.string().length(6),
});

export const POST = withRoute(
  {
    auth: "customer",
    body: bodySchema,
  },
  async ({ actor, body }) => {
    if (!actor || !actor.sessionId) {
      throw new UnauthenticatedError("Active customer session required");
    }

    await authService.changePhone(actor.id, body.new_phone, body.otp_code, actor.sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Primary phone number successfully updated. Other sessions have been revoked.",
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  }
);
