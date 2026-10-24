import { withRoute } from "@/lib/http/route";
import { promotionsService } from "@/modules/promotions";

export const GET = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    const customerId = actor!.id;
    const balance = await promotionsService.getStoreCreditBalance(undefined, customerId);
    const history = await promotionsService.getCustomerCreditHistory(customerId);

    return new Response(
      JSON.stringify({
        balance,
        history,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }
);
