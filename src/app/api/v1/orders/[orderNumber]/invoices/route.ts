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
      orderNumber: z.string().min(1),
    }),
  },
  async ({ params, actor }) => {
    const order = await ordersService.getOrderByNumber(
      undefined,
      params.orderNumber
    );
    if (!order) {
      throw new NotFoundError(`Order '${params.orderNumber}' not found`);
    }

    if (!financePolicies.canViewInvoice(actor, order.customerId)) {
      throw new ForbiddenError("Not authorized to view invoices for this order");
    }

    const invoices = await financeService.getInvoicesForOrder(
      undefined,
      order.id
    );

    const withUrls = await Promise.all(
      invoices.map(async (inv) => {
        const { signedUrl, expiresAt } =
          await financeService.getSignedUrlForInvoice(inv);
        return {
          ...inv,
          download_url: signedUrl,
          download_url_expires_at: expiresAt,
        };
      })
    );

    return NextResponse.json({ invoices: withUrls }, { status: 200 });
  }
);
