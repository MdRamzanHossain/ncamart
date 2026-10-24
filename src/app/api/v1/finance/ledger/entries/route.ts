import { withRoute } from "@/lib/http/route";
import { ledgerService, ledgerPolicies, ListJournalEntriesFilterSchema } from "@/modules/ledger";

export const GET = withRoute(
  {
    auth: "staff",
    query: ListJournalEntriesFilterSchema,
  },
  async ({ actor, query }) => {
    await ledgerPolicies.assertCanReadLedger(actor);

    const result = await ledgerService.listEntries(query);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
