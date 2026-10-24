import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { customerService } from "@/modules/identity";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    const profile = await customerService.getProfile(actor!.id);
    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1).max(100).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  preferred_locale: z.enum(["bn", "en"]).optional(),
  marketing_opt_in: z.boolean().optional(),
});

export const PUT = withRoute(
  {
    auth: "customer",
    body: updateProfileSchema,
  },
  async ({ actor, body }) => {
    const updated = await customerService.updateProfile(actor!.id, {
      full_name: body.full_name,
      email: body.email,
      preferred_locale: body.preferred_locale,
      marketing_opt_in: body.marketing_opt_in,
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
