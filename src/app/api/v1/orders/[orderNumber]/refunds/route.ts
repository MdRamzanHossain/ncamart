import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { ordersRepo } from "@/modules/orders/repo";
import { refundsRepo } from "@/modules/payments/repo";
import { aesGcmDecrypt } from "@/lib/crypto";

export const GET = withRoute(
  {
    auth: "any",
    params: z.object({
      orderNumber: z.string().min(1),
    }),
  },
  async ({ actor, params }) => {
    const order = await ordersRepo.getOrderByNumber(undefined, params.orderNumber);
    if (!order) {
      throw new NotFoundError(`Order '${params.orderNumber}' not found`);
    }

    if (actor?.type === "customer" && order.customerId !== actor.id) {
      throw new ForbiddenError("You cannot view refunds for another customer's order");
    }

    const rows = await refundsRepo.listRefundsForOrder(order.id);
    const refunds = rows.map((r) => {
      let maskedAccount: string | null = null;
      if (r.payoutAccount) {
        try {
          const dec = aesGcmDecrypt(r.payoutAccount);
          maskedAccount = dec.length > 4 ? `***${dec.slice(-4)}` : "***";
        } catch {
          maskedAccount = "***";
        }
      }

      return {
        id: r.id,
        refund_number: r.refundNumber,
        order_id: r.orderId,
        order_item_ids: r.orderItemIds,
        amount_paisa: r.amountPaisa,
        reason: r.reason,
        method: r.method,
        status: r.status,
        is_before_delivery: r.isBeforeDelivery,
        payout_account_masked: maskedAccount,
        due_by: r.dueBy?.toISOString() ?? null,
        created_at: r.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, refunds }, { status: 200 });
  }
);
