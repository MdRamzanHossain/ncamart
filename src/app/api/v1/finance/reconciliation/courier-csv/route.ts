import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { financeService } from "@/modules/finance";
import { ValidationError } from "@/lib/errors";

export async function handleCourierCsvUpload(req: NextRequest, actor: any) {
  const contentType = req.headers.get("content-type") || "";
  let courierPartner = "";
  let csvContent = "";
  let payoutRef: string | undefined;

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await req.formData();
    courierPartner = (formData.get("courier_partner") as string) || "";
    payoutRef = (formData.get("payout_ref") as string) || undefined;
    const file = formData.get("csv_file");
    if (file instanceof File) {
      csvContent = await file.text();
    } else if (typeof file === "string") {
      csvContent = file;
    }
  } else {
    // JSON body fallback
    try {
      const json = await req.json();
      courierPartner = json.courier_partner || json.courierPartner || "";
      payoutRef = json.payout_ref || json.payoutRef;
      csvContent = json.csv_file || json.csv_content || json.csvContent || "";
    } catch {
      throw new ValidationError("Invalid request payload: multipart/form-data or JSON expected");
    }
  }

  if (!courierPartner) {
    throw new ValidationError("Missing required field: courier_partner");
  }
  if (!csvContent || csvContent.trim().length === 0) {
    throw new ValidationError("Missing or empty CSV file content");
  }

  const result = await financeService.reconcileCourierCsv(
    {
      courierPartner,
      csvContent,
      payoutRef,
    },
    actor
  );

  return NextResponse.json(result, { status: 200 });
}

export const POST = withRoute(
  {
    auth: "staff",
    permission: "settlement.reconcile",
  },
  async ({ req, actor }) => {
    return handleCourierCsvUpload(req, actor!);
  }
);
