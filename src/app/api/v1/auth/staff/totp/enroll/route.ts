import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { staffAuthService } from "@/modules/identity";

const enrollSchema = z.object({
  enrollment_token: z.string().min(1),
});

export const POST = withRoute(
  {
    auth: "public",
    body: enrollSchema,
  },
  async ({ body }) => {
    const result = await staffAuthService.enrollTotp(body.enrollment_token);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
