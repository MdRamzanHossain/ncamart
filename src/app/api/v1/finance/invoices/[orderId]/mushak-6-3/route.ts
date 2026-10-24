import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { ordersService } from "@/modules/orders";
import { financeService, financePolicies } from "@/modules/finance";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

export const GET = withRoute(
  {
    auth: "any",
    params: z.object({
      orderId: z.string().uuid(),
    }),
  },
  async ({ params, actor }) => {
    const order = await ordersService.getOrderById(undefined, params.orderId);
    if (!order) {
      throw new NotFoundError(`Order '${params.orderId}' not found`);
    }

    if (!financePolicies.canViewMushakInvoice(actor, order.customerId)) {
      throw new ForbiddenError(
        "Not authorized to view Mushak 6.3 invoice for this order"
      );
    }

    const mushak = await financeService.getMushakInvoiceForOrder(
      undefined,
      params.orderId
    );
    if (!mushak) {
      throw new NotFoundError("Mushak 6.3 invoice not found for this order");
    }

    const { signedUrl, expiresAt } =
      await financeService.getSignedUrlForInvoice(mushak);

    return NextResponse.json(
      {
        invoice: mushak,
        download_url: signedUrl,
        download_url_expires_at: expiresAt,
      },
      { status: 200 }
    );
  }
);
