import { z } from "zod";
import { invoiceTypeEnum, InvoiceLineSnapshot } from "./schema";

export { invoiceTypeEnum };
export type { InvoiceLineSnapshot };

export const InvoiceLineSnapshotSchema = z.object({
  skuId: z.string().uuid(),
  skuCode: z.string(),
  titleEn: z.string(),
  titleBn: z.string().optional(),
  qty: z.number().int().positive(),
  unitPricePaisa: z.number().int().nonnegative(),
  vatRateBp: z.number().int().nonnegative(),
  vatPaisa: z.number().int().nonnegative(),
  lineTotalPaisa: z.number().int().nonnegative(),
});

export const InvoiceDtoSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  invoiceNo: z.string(),
  type: z.enum(invoiceTypeEnum),
  mushakSerial: z.string().nullable(),
  fiscalYear: z.string(),
  buyerName: z.string(),
  buyerBin: z.string().nullable(),
  sellerBin: z.string(),
  lines: z.array(InvoiceLineSnapshotSchema),
  subtotalPaisa: z.number().int(),
  vatPaisa: z.number().int(),
  totalPaisa: z.number().int(),
  pdfMediaId: z.string().uuid().nullable(),
  issuedAt: z.date(),
  createdAt: z.date(),
});

export type InvoiceDto = z.infer<typeof InvoiceDtoSchema>;

export const CreateInvoiceInputSchema = z.object({
  orderId: z.string().uuid(),
  type: z.enum(invoiceTypeEnum),
  buyerName: z.string().min(1),
  buyerBin: z.string().optional().nullable(),
  sellerBin: z.string().min(1),
  lines: z.array(InvoiceLineSnapshotSchema),
  subtotalPaisa: z.number().int().nonnegative(),
  vatPaisa: z.number().int().nonnegative(),
  totalPaisa: z.number().int().nonnegative(),
  issuedAt: z.date().optional(),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;
