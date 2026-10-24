import { ProductRow, SkuRow, CategoryRow } from "./schema";
import { mediaService } from "@/modules/media";

export interface ChecklistResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
}

export async function validateReviewChecklist(
  product: ProductRow,
  category: CategoryRow,
  skus: SkuRow[]
): Promise<ChecklistResult> {
  const failures: string[] = [];
  const warnings: string[] = [];

  // 1. BUDGET_SMART Tier Checklist
  if (product.productTier === "BUDGET_SMART") {
    if (!product.zeroReplicaAttested) {
      failures.push("BUDGET_SMART products require zero-replica attestation before review submission");
    }

    const readyMedia = await mediaService.listMediaByOwner("PRODUCT", product.id);
    const hasPackagingPhoto = readyMedia.some(
      (m) => m.kind === "PRODUCT_IMAGE" && m.status === "READY"
    );
    if (!hasPackagingPhoto) {
      failures.push("BUDGET_SMART products require at least one real-packaging product photo");
    }
  }

  // 2. AUTHENTIC Tier Checklist
  if (product.productTier === "AUTHENTIC") {
    const hasDistributorMediaId = Boolean(product.distributorEvidenceMediaId);
    const readyMedia = await mediaService.listMediaByOwner("PRODUCT", product.id);
    const hasDistributorPhoto = readyMedia.some(
      (m) => m.kind === "DISTRIBUTOR_EVIDENCE" && m.status === "READY"
    );
    if (!hasDistributorMediaId && !hasDistributorPhoto) {
      failures.push("AUTHENTIC products require authorized distributor or invoice evidence");
    }
  }

  // 3. Category BTRC Clearance Requirements
  if (category.btrcClearanceRequired) {
    if (!product.hsCode || product.hsCode.trim().length === 0) {
      failures.push("Categories requiring BTRC clearance must specify an HS Code");
    }
    if (!product.btrcStatus || product.btrcStatus === "NOT_REQUIRED") {
      failures.push("Categories requiring BTRC clearance must have a valid BTRC status (PENDING, APPROVED, or REJECTED)");
    }
  }

  // 4. Product Level General Requirements
  if (!product.productTier) {
    failures.push("Product must have a product tier assigned");
  }
  if (!product.fulfillmentType) {
    failures.push("Product must have a fulfillment type assigned");
  }
  if (product.vatRateBp === null || product.vatRateBp === undefined) {
    failures.push("Product must specify a VAT rate in basis points");
  }

  // 5. SKU Level Requirements
  if (!skus || skus.length === 0) {
    failures.push("Product must have at least one SKU variant before submission");
  } else {
    for (const sku of skus) {
      if (!sku.weightGrams || sku.weightGrams <= 0) {
        failures.push(`SKU '${sku.skuCode}' must specify a positive weight in grams`);
      }
    }
  }

  // 6. Comparison Group (Warn only if none)
  if (!product.comparisonGroupId) {
    warnings.push("Product does not belong to a comparison group");
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
  };
}
