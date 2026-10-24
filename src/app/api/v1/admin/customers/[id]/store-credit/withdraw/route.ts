import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { promotionsService, WithdrawStoreCreditSchema } from "@/modules/promotions";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({ id: z.string() }),
    body: WithdrawStoreCreditSchema,
  },
  async ({ actor, body, params }) => {
    const customerId = params.id;
    const result = await promotionsService.withdrawStoreCredit(
      undefined,
      customerId,
      body,
      actor!
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
