import { NextResponse } from "next/server";
import { checkSystemHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkSystemHealth();
  const statusCode = health.status === "ok" ? 200 : health.status === "degraded" ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
