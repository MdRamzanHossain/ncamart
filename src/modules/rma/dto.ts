import { z } from "zod";
import {
  claimTypeEnum,
  claimStatusEnum,
  claimPriorityEnum,
  claimRejectionReasonEnum,
  claimResolutionEnum,
  distributorOutcomeEnum,
} from "./schema";

export {
  claimTypeEnum,
  claimStatusEnum,
  claimPriorityEnum,
  claimRejectionReasonEnum,
  claimResolutionEnum,
  distributorOutcomeEnum,
};

// --------------------------------------------------------------------------
// Request Schemas
// --------------------------------------------------------------------------
export const submitClaimSchema = z.object({
  seal_id: z.string().min(1, "Seal ID is required"),
  order_id: z.string().uuid("Invalid order ID format").optional(),
  issue_description: z
    .string()
    .min(5, "Issue description must be at least 5 characters"),
  media_ids: z.array(z.string().uuid()).optional().default([]),
  unboxing_video_r2_key: z.string().optional(),
  is_doa: z.boolean().optional().default(false),
  wants_assisted_transit: z.boolean().optional().default(false),
  claim_type: z.enum(claimTypeEnum).optional(),
});
export type SubmitClaimInput = z.infer<typeof submitClaimSchema>;

export const adjudicateClaimSchema = z
  .object({
    decision: z.enum(["APPROVED_FOR_RETURN", "REJECTED"]),
    rejection_reason: z.enum(claimRejectionReasonEnum).optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.decision === "REJECTED" && !data.rejection_reason) {
        return false;
      }
      return true;
    },
    {
      message: "rejection_reason is required when decision is REJECTED",
      path: ["rejection_reason"],
    }
  );
export type AdjudicateClaimInput = z.infer<typeof adjudicateClaimSchema>;

export const inspectClaimSchema = z.object({
  verified_defect: z.boolean(),
  seal_intact: z.boolean(),
  notes: z.string().optional(),
  photos: z.array(z.string()).optional(),
  photo_media_ids: z.array(z.string().uuid()).optional(),
  resolution: z.enum(claimResolutionEnum).optional(),
  rejection_reason: z.enum(claimRejectionReasonEnum).optional(),
});
export type InspectClaimInput = z.infer<typeof inspectClaimSchema>;

export const liaisonClaimSchema = z.object({
  distributor_name: z.string().optional(),
  notes: z.string().optional(),
});
export type LiaisonClaimInput = z.infer<typeof liaisonClaimSchema>;

export const liaisonReturnedSchema = z.object({
  outcome: z.enum(distributorOutcomeEnum),
  notes: z.string().optional(),
});
export type LiaisonReturnedInput = z.infer<typeof liaisonReturnedSchema>;

export const listClaimsQuerySchema = z.object({
  status: z.enum(claimStatusEnum).optional(),
  priority: z.enum(claimPriorityEnum).optional(),
  claim_type: z.enum(claimTypeEnum).optional(),
  customer_id: z.string().uuid().optional(),
  seal_id: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});
export type ListClaimsQuery = z.infer<typeof listClaimsQuerySchema>;

// --------------------------------------------------------------------------
// Response DTOs
// --------------------------------------------------------------------------
export interface OfficialServiceCenterInfo {
  distributor_name: string;
  is_authorized: boolean;
  contact_note: string;
}

export interface ClaimSubmissionResponseDto {
  claim_number: string;
  claim_stage: string;
  message: string;
  sla_due_at?: string | null;
  official_service_center?: OfficialServiceCenterInfo | null;
}

export interface ClaimEventItemDto {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_type: string;
  actor_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ClaimMediaItemDto {
  id: string;
  purpose: string;
  content_type: string;
  url: string;
  expires_in_seconds?: number;
}

export interface ClaimDetailDto {
  id: string;
  claim_number: string;
  seal_id: string;
  order_id: string;
  customer_id: string;
  claim_type: string;
  issue_description: string;
  status: string;
  priority: string;
  decision: string | null;
  rejection_reason: string | null;
  resolution: string | null;
  reverse_shipment_id: string | null;
  replacement_order_id: string | null;
  sla_due_at: string | null;
  is_non_original_owner: boolean;
  wants_assisted_transit: boolean;
  distributor_name: string | null;
  distributor_sent_at: string | null;
  distributor_returned_at: string | null;
  distributor_outcome: string | null;
  liaison_task_id: string | null;
  inspection_notes: string | null;
  verified_defect: boolean | null;
  seal_intact: boolean | null;
  adjudicated_by: string | null;
  adjudicated_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  events?: ClaimEventItemDto[];
  media?: ClaimMediaItemDto[];
}
