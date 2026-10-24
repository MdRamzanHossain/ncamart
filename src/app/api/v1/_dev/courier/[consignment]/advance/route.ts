import { NextRequest, NextResponse } from "next/server";
import { logisticsService } from "@/modules/logistics";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ consignment: string }> }
) {
  const { consignment } = await params;
  let targetStatus: string | undefined;
  try {
    const body = (await req.json()) as { target_status?: string };
    targetStatus = body.target_status;
  } catch {
    // Body is optional
  }

  const result = await logisticsService.advanceMockConsignment(
    consignment,
    targetStatus
  );
  return NextResponse.json(result, { status: 200 });
}
