import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ledgerService, ledgerPolicies } from "@/modules/ledger";

const querySchema = z.object({
  asOf: z.coerce.date().optional(),
  as_of: z.coerce.date().optional(),
});

export const GET = withRoute(
  {
    auth: "staff",
    query: querySchema,
  },
  async ({ actor, query }) => {
    await ledgerPolicies.assertCanReadLedger(actor);

    const asOf = query.asOf ?? query.as_of ?? new Date();
    const trialBalance = await ledgerService.trialBalance(asOf);

    return new Response(JSON.stringify(trialBalance), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
