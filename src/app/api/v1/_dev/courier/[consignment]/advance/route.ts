import { NextRequest, NextResponse } from "next/server";
import { logisticsService } from "@/modules/logistics";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ consignment: string }> }
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: {
          code: "ERR_NOT_FOUND",
          message: "Dev courier simulation endpoint is disabled in production.",
        },
      },
      { status: 404 }
    );
  }

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
