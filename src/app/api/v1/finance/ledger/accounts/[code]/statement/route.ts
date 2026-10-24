import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ledgerService, ledgerPolicies, AccountStatementFilterSchema } from "@/modules/ledger";

export const GET = withRoute(
  {
    auth: "staff",
    params: z.object({ code: z.string().min(1) }),
    query: AccountStatementFilterSchema,
  },
  async ({ actor, params, query }) => {
    await ledgerPolicies.assertCanReadLedger(actor);

    const statement = await ledgerService.getAccountStatement(params.code, query);

    return new Response(JSON.stringify(statement), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
