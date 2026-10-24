import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  receiptCompleteSchema,
  assertCanRunRunner,
} from "@/modules/sourcing";
import { ValidationError } from "@/lib/errors";

export const POST = withRoute(
  {
    auth: "staff",
    body: receiptCompleteSchema.optional(),
  },
  async ({ body, params, actor }) => {
    assertCanRunRunner(actor);
    const purchaseId = (params as { id: string }).id;
    const mediaId = body?.media_id;
    if (!mediaId) {
      throw new ValidationError("media_id is required to complete receipt upload");
    }

    const updated = await sourcingService.completeReceiptUpload(
      purchaseId,
      mediaId,
      actor!
    );
    return NextResponse.json(updated, { status: 200 });
  }
);
