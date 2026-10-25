import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/route";
import { financeService } from "@/modules/finance";
import { ValidationError } from "@/lib/errors";

export const POST = withRoute(
  {
    auth: "staff",
    permission: "settlement.reconcile",
  },
  async ({ req, actor }) => {
    const contentType = req.headers.get("content-type") || "";
    let csvContent = "";
    let payoutRef: string | undefined;

    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await req.formData();
      payoutRef = (formData.get("payout_ref") as string) || undefined;
      const file = formData.get("csv_file");
      if (file instanceof File) {
        csvContent = await file.text();
      } else if (typeof file === "string") {
        csvContent = file;
      }
    } else {
      try {
        const json = await req.json();
        payoutRef = json.payout_ref || json.payoutRef;
        csvContent = json.csv_file || json.csv_content || json.csvContent || "";
      } catch {
        throw new ValidationError("Invalid request payload: multipart/form-data or JSON expected");
      }
    }

    if (!csvContent || csvContent.trim().length === 0) {
      throw new ValidationError("Missing or empty CSV file content for gateway settlement");
    }

    const result = await financeService.reconcileGatewaySettlement(
      {
        csvContent,
        payoutRef,
      },
      actor!
    );

    return NextResponse.json(result, { status: 200 });
  }
);
