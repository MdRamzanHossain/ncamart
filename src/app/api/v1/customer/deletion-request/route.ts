import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { adminCustomerService } from "@/modules/identity/adminCustomerService";

export const POST = withRoute(
  {
    auth: "customer",
  },
  async ({ actor }) => {
    const result = await adminCustomerService.createCustomerDeletionRequest(actor!.id);
    return NextResponse.json(result, { status: 201 });
  }
);
