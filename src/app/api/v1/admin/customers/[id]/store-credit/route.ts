import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { promotionsService, IssueStoreCreditSchema } from "@/modules/promotions";

export const POST = withRoute(
  {
    auth: "staff",
    params: z.object({ id: z.string() }),
    body: IssueStoreCreditSchema,
  },
  async ({ actor, body, params }) => {
    const customerId = params.id;
    const entry = await promotionsService.issueStoreCredit(undefined, {
      customerId,
      amountPaisa: body.amountPaisa,
      reason: body.reason,
      withdrawable: body.withdrawable,
      expiresAt: body.expiresAt,
      refType: body.refType,
      refId: body.refId,
      actor: actor!,
    });

    return new Response(JSON.stringify({ entry }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }
);
