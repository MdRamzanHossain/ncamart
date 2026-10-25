import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { financeService } from "@/modules/finance";
import { ListExceptionsQuerySchema } from "@/modules/finance/dto";

export const GET = withRoute(
  {
    auth: "staff",
    query: ListExceptionsQuerySchema,
  },
  async ({ query, actor }) => {
    const result = await financeService.listExceptions(query, actor!);
    return NextResponse.json(result, { status: 200 });
  }
);
