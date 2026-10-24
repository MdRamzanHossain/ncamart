import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";
import { MediaAssetRow } from "./schema";
import { UploadPurpose } from "./dto";

export function assertCanUpload(actor: Actor, purpose: UploadPurpose): void {
  if (actor.type === "customer") {
    if (purpose === "RMA_PHOTO" || purpose === "RMA_VIDEO") {
      return; // Customer allowed for RMA media
    }
    throw new ForbiddenError(
      `Customers are not authorized to upload '${purpose}' media assets`
    );
  }

  if (actor.type === "staff") {
    const roles = actor.roles || [];
    if (roles.includes("SUPER_ADMIN")) return;

    if (purpose === "PRODUCT_IMAGE" && roles.includes("CATALOG_SPECIALIST")) return;
    if (purpose === "QC_PHOTO" && (roles.includes("QC_TECHNICIAN") || roles.includes("GODOWN_MANAGER"))) return;
    if (purpose === "RECEIPT_PHOTO" && (roles.includes("RUNNER") || roles.includes("SOURCING_MANAGER"))) return;
    if (purpose === "REFUND_PROOF" && roles.includes("FINANCE_OFFICER")) return;
    if ((purpose === "RMA_PHOTO" || purpose === "RMA_VIDEO") && roles.includes("SUPPORT_AGENT")) return;

    throw new ForbiddenError(
      `Staff role(s) [${roles.join(", ")}] cannot upload '${purpose}' media`
    );
  }

  throw new ForbiddenError("Authentication required to upload media assets");
}

export function canAccessMedia(actor: Actor | null, media: MediaAssetRow): boolean {
  // 1. Public media is accessible by anyone
  if (media.isPublic) return true;

  // 2. Private media requires an authenticated actor
  if (!actor) return false;

  // 3. Customer ownership check
  if (actor.type === "customer") {
    return media.uploadedById === actor.id || media.ownerId === actor.id;
  }

  // 4. Staff RBAC permissions
  if (actor.type === "staff") {
    const roles = actor.roles || [];
    if (roles.includes("SUPER_ADMIN")) return true;

    // Support can access RMA media and customer-uploaded files
    if (
      roles.includes("SUPPORT_AGENT") &&
      (media.kind === "RMA_PHOTO" || media.kind === "RMA_VIDEO" || media.uploadedByType === "CUSTOMER")
    ) {
      return true;
    }

    // Finance can access refund proofs, runner purchase receipts, and invoice PDFs
    if (
      roles.includes("FINANCE_OFFICER") &&
      (media.kind === "REFUND_PROOF" || media.kind === "RECEIPT_PHOTO" || media.kind === "INVOICE_PDF")
    ) {
      return true;
    }

    // QC & Godown staff can access QC photos
    if (
      (roles.includes("QC_TECHNICIAN") || roles.includes("GODOWN_MANAGER")) &&
      (media.kind === "QC_PHOTO" || media.kind === "DISTRIBUTOR_EVIDENCE")
    ) {
      return true;
    }

    // Sourcing managers can access runner purchase receipts
    if (roles.includes("SOURCING_MANAGER") && media.kind === "RECEIPT_PHOTO") {
      return true;
    }

    // Uploader staff member can always access their uploaded media
    if (media.uploadedById === actor.id) {
      return true;
    }
  }

  return false;
}

export function assertCanAccessMedia(actor: Actor | null, media: MediaAssetRow): void {
  if (!canAccessMedia(actor, media)) {
    throw new ForbiddenError("You do not have permission to access this private media asset");
  }
}

export function assertCanManageMedia(actor: Actor, media: MediaAssetRow): void {
  if (actor.type === "staff" && actor.roles?.includes("SUPER_ADMIN")) {
    return;
  }

  if (media.uploadedById === actor.id) {
    return;
  }

  throw new ForbiddenError("You do not have permission to abort or modify this media asset");
}
