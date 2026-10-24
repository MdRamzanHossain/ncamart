import { withRoute } from "@/lib/http/route";
import { customerService } from "@/modules/identity";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    // TODO(P26): Holographic Seal Engine & active warranty tracking
    const warranties = await customerService.getWarranties(actor!.id);

    return new Response(JSON.stringify(warranties), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
