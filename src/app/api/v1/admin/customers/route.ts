import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { adminCustomerService } from "@/modules/identity/adminCustomerService";

const querySchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "pii.read.full",
    query: querySchema,
  },
  async ({ query, actor }) => {
    const result = await adminCustomerService.searchCustomerByPhone(query.phone, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
