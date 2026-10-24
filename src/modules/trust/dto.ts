import { z } from "zod";
import {
  sealStatusEnum,
  qcTypeEnum,
  qcResultEnum,
  sealVoidReasonEnum,
  sealVoidRequestStatusEnum,
} from "./schema";
import { SEAL_REGEX } from "./crockford";

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------
// 5% sampling for supervisor audit (500 basis points)
export const QC_SAMPLING_BP = 500;
// 120 minutes audit deadline for sampled records
export const QC_AUDIT_DEADLINE_MINUTES = 120;

// --------------------------------------------------------------------------
// QC Checklist Schemas
// --------------------------------------------------------------------------
export const threePointChecklistSchema = z.object({
  power_voltage_ok: z.boolean().default(true),
  port_function_ok: z.boolean().default(true),
  physical_integrity_ok: z.boolean().default(true),
  voltage_reading: z.number().optional(),
  current_reading: z.number().optional(),
  cable_resistance_ohm: z.number().optional(),
  firmware_verified: z.boolean().optional(),
  physical_integrity_check: z.boolean().optional(),
});
export type ThreePointChecklist = z.infer<typeof threePointChecklistSchema>;

export const nonInvasiveChecklistSchema = z.object({
  hologram_check_ok: z.boolean().default(true),
  box_serial_matches_invoice: z.boolean().default(true),
  packaging_integrity_ok: z.boolean().default(true),
  factory_seal_intact: z.boolean().default(true),
});
export type NonInvasiveChecklist = z.infer<typeof nonInvasiveChecklistSchema>;

export const fullPreDispatchChecklistSchema = z.object({
  unbox_inspection_ok: z.boolean().default(true),
  functional_test_ok: z.boolean().default(true),
  power_reading: z.number().optional(),
  temperature_celsius: z.number().optional(),
  voltage_reading: z.number().optional(),
});
export type FullPreDispatchChecklist = z.infer<typeof fullPreDispatchChecklistSchema>;

export function validateChecklistForQcType(
  qcType: string,
  rawChecklist: unknown
): Record<string, unknown> {
  if (qcType === "THREE_POINT") {
    return threePointChecklistSchema.parse(rawChecklist);
  }
  if (qcType === "NON_INVASIVE") {
    return nonInvasiveChecklistSchema.parse(rawChecklist);
  }
  if (qcType === "FULL_PRE_DISPATCH") {
    return fullPreDispatchChecklistSchema.parse(rawChecklist);
  }
  throw new Error(`Unsupported QC type: ${qcType}`);
}

// --------------------------------------------------------------------------
// DTO Schemas
// --------------------------------------------------------------------------
export const qcInspectSchema = z.object({
  sku_id: z.string().uuid(),
  order_id: z.string().uuid().optional(),
  order_item_unit_id: z.string().uuid().optional(),
  qc_type: z.enum(qcTypeEnum),
  checklist: z.record(z.unknown()),
  passed: z.boolean(),
  oem_manufacturer_serial: z.string().trim().min(1).optional(),
  photos: z.array(z.string()).default([]),
  tester_notes: z.string().trim().optional(),
});
export type QcInspectDto = z.infer<typeof qcInspectSchema>;

export const mintSealSchema = z.object({
  qc_record_id: z.string().uuid(),
  sku_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
});
export type MintSealDto = z.infer<typeof mintSealSchema>;

export const applySealSchema = z.object({
  order_item_unit_id: z.string().uuid(),
});
export type ApplySealDto = z.infer<typeof applySealSchema>;

export const voidSealSchema = z.object({
  seal_id: z.string().trim(),
  reason: z.enum(sealVoidReasonEnum),
});
export type VoidSealDto = z.infer<typeof voidSealSchema>;

export const approveVoidRequestSchema = z.object({
  notes: z.string().trim().optional(),
});
export type ApproveVoidRequestDto = z.infer<typeof approveVoidRequestSchema>;

export const supervisorAuditSchema = z.object({
  result: z.enum(qcResultEnum),
  notes: z.string().trim().optional(),
});
export type SupervisorAuditDto = z.infer<typeof supervisorAuditSchema>;

// --------------------------------------------------------------------------
// Label Builders (TSPL & ZPL, 50x30 mm)
// --------------------------------------------------------------------------
export interface SealLabelPayload {
  tspl: string;
  zpl: string;
  qr_url: string;
  tier_mark: string;
}

export function buildSealLabel(sealId: string, tierMark: string): SealLabelPayload {
  const qrUrl = `https://ncamart.com/verify?q=${sealId}`;

  // TSPL 50mm x 30mm label
  const tspl = [
    "SIZE 50 mm, 30 mm",
    "GAP 2 mm, 0 mm",
    "DIRECTION 1",
    "CLS",
    `QRCODE 40,30,L,4,A,0,"${qrUrl}"`,
    `TEXT 160,30,"3",0,1,1,"NCAMart Verified"`,
    `TEXT 160,70,"2",0,1,1,"${tierMark}"`,
    `TEXT 160,110,"2",0,1,1,"${sealId}"`,
    "PRINT 1",
    "",
  ].join("\r\n");

  // ZPL 50mm x 30mm label (at 203 DPI: 50mm ≈ 400 dots, 30mm ≈ 240 dots)
  const zpl = [
    "^XA",
    "^PW400",
    "^LL240",
    `^FO40,30^BQN,2,4^FDQA,${qrUrl}^FS`,
    `^FO160,30^A0N,28,28^FDNCAMart Verified^FS`,
    `^FO160,70^A0N,22,22^FD${tierMark}^FS`,
    `^FO160,110^A0N,24,24^FD${sealId}^FS`,
    "^XZ",
  ].join("\r\n");

  return {
    tspl,
    zpl,
    qr_url: qrUrl,
    tier_mark: tierMark,
  };
}
