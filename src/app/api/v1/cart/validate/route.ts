import { withRoute } from "@/lib/http/route";
import { validateCart, CartValidateInputSchema } from "@/modules/orders";

export const POST = withRoute(
  {
    auth: "public",
    body: CartValidateInputSchema,
  },
  async ({ body, actor }) => {
    const result = await validateCart(undefined, body, actor ?? undefined);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
);
