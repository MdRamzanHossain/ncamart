import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { customerService } from "@/modules/identity";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const POST = withRoute(
  {
    auth: "customer",
    params: paramsSchema,
  },
  async ({ actor, params }) => {
    const updated = await customerService.setDefaultAddress(actor!.id, params.id);

    return new Response(
      JSON.stringify({
        success: true,
        address_id: updated.id,
        address: updated,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }
);
