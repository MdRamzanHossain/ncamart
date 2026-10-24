import { withRoute } from "@/lib/http/route";
import { catalogService, CreateComparisonGroupDtoSchema } from "@/modules/catalog";
import { NextResponse } from "next/server";

export const GET = withRoute(
  {
    auth: "staff",
    permission: "catalog.read",
  },
  async () => {
    const list = await catalogService.listComparisonGroups();
    return NextResponse.json(list, { status: 200 });
  }
);

export const POST = withRoute(
  {
    auth: "staff",
    permission: "catalog.draft",
    body: CreateComparisonGroupDtoSchema,
  },
  async ({ body, actor }) => {
    const group = await catalogService.createComparisonGroup(body, actor!);
    return NextResponse.json(group, { status: 201 });
  }
);
