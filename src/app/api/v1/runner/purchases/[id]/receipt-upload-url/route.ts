import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import {
  sourcingService,
  receiptUploadUrlSchema,
  assertCanRunRunner,
} from "@/modules/sourcing";

export const POST = withRoute(
  {
    auth: "staff",
    body: receiptUploadUrlSchema.optional(),
  },
  async ({ body, params, actor }) => {
    assertCanRunRunner(actor);
    const purchaseId = (params as { id: string }).id;
    const result = await sourcingService.getReceiptUploadUrl(
      purchaseId,
      body ?? {},
      actor!
    );
    return NextResponse.json(result, { status: 200 });
  }
);
