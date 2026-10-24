import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { customerService } from "@/modules/identity";

const verifyEmailSchema = z.object({
  code: z.string().length(6),
});

export const POST = withRoute(
  {
    auth: "customer",
    body: verifyEmailSchema,
  },
  async ({ actor, body }) => {
    const result = await customerService.verifyEmail(actor!.id, body.code);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
