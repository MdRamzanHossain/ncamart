import { z } from "zod";
import { withRoute } from "@/lib/http/route";
import { catalogService, CreateComparisonGroupDtoSchema } from "@/modules/catalog";
import { NextResponse } from "next/server";

const paramsSchema = z.object({
  id: z.string(),
});

export const GET = withRoute(
  {
    auth: "staff",
    permission: "catalog.read",
    params: paramsSchema,
  },
  async ({ params }) => {
    const group = await catalogService.getComparisonGroupById(params.id);
    return NextResponse.json(group, { status: 200 });
  }
);

export const PUT = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
    body: CreateComparisonGroupDtoSchema.partial(),
  },
  async ({ params, body, actor }) => {
    const updated = await catalogService.updateComparisonGroup(params.id, body, actor!);
    return NextResponse.json(updated, { status: 200 });
  }
);

export const DELETE = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    params: paramsSchema,
  },
  async ({ params, actor }) => {
    await catalogService.deleteComparisonGroup(params.id, actor!);
    return NextResponse.json({ success: true }, { status: 200 });
  }
);
