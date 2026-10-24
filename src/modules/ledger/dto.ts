import { z } from "zod";
import {
  subLedgerTypeEnum,
  AccountType,
  NormalSide,
  PostedByType,
} from "./schema";

export const JournalLineInputSchema = z
  .object({
    accountCode: z.string().min(1),
    debitPaisa: z.number().int().nonnegative().default(0),
    creditPaisa: z.number().int().nonnegative().default(0),
    subLedgerType: z.enum(subLedgerTypeEnum).optional(),
    subLedgerRef: z.string().trim().optional(),
  })
  .refine((data) => (data.debitPaisa === 0) !== (data.creditPaisa === 0), {
    message: "Each journal line must have either debit > 0 or credit > 0, but never both or zero",
  });

export type JournalLineInput = z.infer<typeof JournalLineInputSchema>;

export const PostJournalEntrySchema = z.object({
  eventType: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  description: z.string().min(1),
  lines: z.array(JournalLineInputSchema).min(2),
  postedAt: z.coerce.date().optional(),
});

export type PostJournalEntryInput = {
  eventType: string;
  sourceType: string;
  sourceId: string;
  description: string;
  lines: JournalLineInput[];
  postedAt?: Date;
  postedByType?: PostedByType;
  postedById?: string | null;
};

export const ListJournalEntriesFilterSchema = z.object({
  eventType: z.string().trim().optional(),
  sourceType: z.string().trim().optional(),
  sourceId: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type ListJournalEntriesFilterDto = z.input<typeof ListJournalEntriesFilterSchema>;

export const AccountStatementFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  subLedgerRef: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type AccountStatementFilterDto = z.input<typeof AccountStatementFilterSchema>;

export interface TrialBalanceAccountItem {
  code: string;
  name: string;
  debit_paisa: number;
  credit_paisa: number;
}

export interface TrialBalanceSummary {
  as_of_date: string;
  accounts: TrialBalanceAccountItem[];
  total_debits_paisa: number;
  total_credits_paisa: number;
  is_balanced: boolean;
  totalDebitPaisa?: number;
  totalCreditPaisa?: number;
  isBalanced?: boolean;
}

export interface AccountStatementItem {
  id: string;
  entryId: string;
  entryNumber: string;
  eventType: string;
  postedAt: string;
  description: string;
  debitPaisa: number;
  creditPaisa: number;
  subLedgerType?: string | null;
  subLedgerRef?: string | null;
}

export interface AccountStatementSummary {
  account: {
    code: string;
    name: string;
    type: AccountType;
    normalSide: NormalSide;
    isContra: boolean;
  };
  asOf: string;
  openingBalancePaisa: number;
  closingBalancePaisa: number;
  items: AccountStatementItem[];
  totalDebitsPaisa: number;
  totalCreditsPaisa: number;
  total: number;
}
