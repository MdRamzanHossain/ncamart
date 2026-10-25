import crypto from "node:crypto";
import { Tx } from "@/lib/db";
import { logger } from "@/lib/logger";
import { emitOutbox } from "@/lib/outbox";
import { Actor } from "@/lib/http/route";
import { BusinessError, NotFoundError, ValidationError } from "@/lib/errors";
import { generateJournalNumber } from "@/db/counters";
import {
  JournalEntryRow,
  JournalLineRow,
  InsertJournalLineRow,
  InsertJournalEntryRow,
  LedgerAccountRow,
} from "./schema";
import {
  PostJournalEntryInput,
  ListJournalEntriesFilterDto,
  AccountStatementFilterDto,
  TrialBalanceSummary,
  AccountStatementSummary,
} from "./dto";
import { ledgerRepo, clearMemoryLedgerForTesting } from "./repo";
export { clearMemoryLedgerForTesting };

export const ledgerService = {
  /**
   * Seed the Chart of Accounts (architechture.md §10.2).
   */
  async seedChartOfAccounts(tx?: Tx): Promise<void> {
    await ledgerRepo.seedAccountsIfEmpty(tx);
  },

  /**
   * Post a balanced journal entry inside an existing business transaction.
   * - Validates balance in application code (sum of debits == sum of credits).
   * - Enforces one-sided positive line invariant.
   * - Idempotent: returns the existing entry if (eventType, sourceType, sourceId) already posted.
   * - Translates accountCode into accountId and checks requiresSubLedger.
   */
  async post(
    tx: Tx | undefined,
    input: PostJournalEntryInput,
    actor?: Actor | null
  ): Promise<JournalEntryRow & { lines: JournalLineRow[] }> {
    // 1. Idempotency check: if this business event has already been posted, return existing entry
    const existing = await ledgerRepo.getEntryByEventIdempotency(
      tx,
      input.eventType,
      input.sourceType,
      input.sourceId
    );
    if (existing) {
      const full = await ledgerRepo.getEntryById(tx, existing.id);
      if (full) return full;
    }

    if (!input.lines || input.lines.length < 2) {
      throw new ValidationError("A journal entry must contain at least 2 lines");
    }

    // 2. Validate application-level balance: sum(debit) == sum(credit)
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of input.lines) {
      const debit = line.debitPaisa ?? 0;
      const credit = line.creditPaisa ?? 0;

      if (debit < 0 || credit < 0) {
        throw new ValidationError("Debit and credit amounts must be non-negative integers");
      }

      if ((debit === 0) === (credit === 0)) {
        throw new ValidationError(
          `Journal line for account '${line.accountCode}' must have either debit > 0 or credit > 0, never both or neither`
        );
      }

      totalDebit += debit;
      totalCredit += credit;
    }

    if (totalDebit !== totalCredit) {
      throw new BusinessError(
        "ERR_UNBALANCED_JOURNAL_ENTRY",
        `Journal entry is unbalanced: total debits ৳${(totalDebit / 100).toFixed(2)} do not equal total credits ৳${(totalCredit / 100).toFixed(2)}`,
        { totalDebitPaisa: totalDebit, totalCreditPaisa: totalCredit },
        422
      );
    }

    // 3. Resolve accounts and validate sub-ledger requirements
    const accountsCache = new Map<string, LedgerAccountRow>();
    const lineRows: InsertJournalLineRow[] = [];
    const entryId = crypto.randomUUID();
    const postedAt = input.postedAt ?? new Date();

    for (const line of input.lines) {
      let acc = accountsCache.get(line.accountCode);
      if (!acc) {
        const found = await ledgerRepo.getAccountByCode(tx, line.accountCode);
        if (!found) {
          throw new NotFoundError(`Ledger account code '${line.accountCode}' not found`);
        }
        acc = found;
        accountsCache.set(line.accountCode, acc);
      }

      // Check sub-ledger requirement
      if (acc.requiresSubLedger && !line.subLedgerRef) {
        throw new ValidationError(
          `Account '${acc.code} (${acc.name})' requires a sub-ledger reference (sub_ledger_ref)`
        );
      }

      lineRows.push({
        id: crypto.randomUUID(),
        entryId,
        accountId: acc.id,
        subLedgerType: line.subLedgerType ?? null,
        subLedgerRef: line.subLedgerRef ?? null,
        debitPaisa: line.debitPaisa,
        creditPaisa: line.creditPaisa,
        createdAt: postedAt,
      });
    }

    // 4. Generate gapless entry number: JRN-YYYYMMDD-NNNNN
    const entryNumber = await generateJournalNumber(tx ?? null, postedAt);

    // 5. Build entry row
    const postedByType = actor?.type === "staff" ? "STAFF" : (input.postedByType ?? "SYSTEM");
    const postedById = actor?.id ?? input.postedById ?? null;

    const entryRow: InsertJournalEntryRow = {
      id: entryId,
      entryNumber,
      eventType: input.eventType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      description: input.description,
      postedAt,
      postedByType,
      postedById,
      reversalOf: null,
      createdAt: postedAt,
    };

    // 6. Write to database (will fire assert_entry_balanced deferred constraint trigger)
    const saved = await ledgerRepo.createEntry(tx, entryRow, lineRows);

    try {
      await emitOutbox(tx, {
        aggregateType: "journal_entry",
        aggregateId: saved.id,
        type: "ledger.entry_posted",
        payload: {
          entryId: saved.id,
          entryNumber: saved.entryNumber,
          eventType: saved.eventType,
          sourceType: saved.sourceType,
          sourceId: saved.sourceId,
          totalPaisa: totalDebit,
          postedAt: saved.postedAt.toISOString(),
        },
      });
    } catch (err) {
      logger.warn({ err, entryId: saved.id }, "Failed to emit ledger.entry_posted outbox event");
    }

    return saved;
  },

  /**
   * Reverse an existing journal entry by creating a mirror entry with debits and credits swapped.
   */
  async reverse(
    tx: Tx | undefined,
    entryId: string,
    reason: string,
    actor?: Actor | null
  ): Promise<JournalEntryRow & { lines: JournalLineRow[] }> {
    const existing = await ledgerRepo.getEntryById(tx, entryId);
    if (!existing) {
      throw new NotFoundError(`Journal entry '${entryId}' not found`);
    }

    const postedAt = new Date();
    const reversalEntryNumber = await generateJournalNumber(tx ?? null, postedAt);
    const reversalEntryId = crypto.randomUUID();

    const reversalLines: InsertJournalLineRow[] = existing.lines.map((l) => ({
      id: crypto.randomUUID(),
      entryId: reversalEntryId,
      accountId: l.accountId,
      subLedgerType: l.subLedgerType,
      subLedgerRef: l.subLedgerRef,
      // Mirror: swap debit and credit
      debitPaisa: l.creditPaisa,
      creditPaisa: l.debitPaisa,
      createdAt: postedAt,
    }));

    const postedByType = actor?.type === "staff" ? "STAFF" : "SYSTEM";
    const postedById = actor?.id ?? null;

    const reversalEntryRow: InsertJournalEntryRow = {
      id: reversalEntryId,
      entryNumber: reversalEntryNumber,
      eventType: `REVERSAL_${existing.eventType}`,
      sourceType: existing.sourceType,
      sourceId: `${existing.sourceId}_REV_${reversalEntryNumber}`,
      description: `Reversal of ${existing.entryNumber}: ${reason}`,
      postedAt,
      postedByType,
      postedById,
      reversalOf: existing.id,
      createdAt: postedAt,
    };

    const saved = await ledgerRepo.createEntry(tx, reversalEntryRow, reversalLines);

    try {
      await emitOutbox(tx, {
        aggregateType: "journal_entry",
        aggregateId: saved.id,
        type: "ledger.entry_reversed",
        payload: {
          reversalEntryId: saved.id,
          reversalEntryNumber: saved.entryNumber,
          originalEntryId: existing.id,
          originalEntryNumber: existing.entryNumber,
          reason,
          postedAt: saved.postedAt.toISOString(),
        },
      });
    } catch (err) {
      logger.warn({ err, reversalEntryId: saved.id }, "Failed to emit ledger.entry_reversed event");
    }

    return saved;
  },

  // --------------------------------------------------------------------------
  // Financial Queries
  // --------------------------------------------------------------------------
  async accountBalance(
    code: string,
    asOf?: Date,
    subLedgerRef?: string
  ): Promise<{ account: LedgerAccountRow; debitPaisa: number; creditPaisa: number; netBalancePaisa: number }> {
    return ledgerRepo.getAccountBalance(undefined, code, asOf, subLedgerRef);
  },

  async trialBalance(asOf?: Date): Promise<TrialBalanceSummary> {
    return ledgerRepo.getTrialBalance(undefined, asOf);
  },

  async getTrialBalance(asOf?: Date): Promise<TrialBalanceSummary> {
    return this.trialBalance(asOf);
  },

  async subLedgerBalance(
    accountCode: string,
    asOf?: Date
  ): Promise<{ subLedgerRef: string; debitPaisa: number; creditPaisa: number; netBalancePaisa: number }[]> {
    return ledgerRepo.getSubLedgerBalances(undefined, accountCode, asOf);
  },

  async listEntries(
    filter: ListJournalEntriesFilterDto
  ): Promise<{ items: (JournalEntryRow & { linesCount: number; totalPaisa: number })[]; total: number }> {
    return ledgerRepo.listEntries(undefined, filter);
  },

  async listJournalEntries(
    filter: ListJournalEntriesFilterDto
  ): Promise<{ entries: (JournalEntryRow & { lines: (JournalLineRow & { accountCode: string; accountName: string })[] })[]; total: number }> {
    const res = await ledgerRepo.listEntries(undefined, filter);
    const entries = await Promise.all(
      res.items.map(async (item) => {
        const full = await ledgerRepo.getEntryById(undefined, item.id);
        return full!;
      })
    );
    return { entries: entries.filter(Boolean), total: res.total };
  },

  async getEntryById(
    id: string
  ): Promise<(JournalEntryRow & { lines: (JournalLineRow & { accountCode: string; accountName: string })[] }) | null> {
    return ledgerRepo.getEntryById(undefined, id);
  },

  async getAccountStatement(
    code: string,
    filter: AccountStatementFilterDto = {}
  ): Promise<AccountStatementSummary> {
    return ledgerRepo.getAccountStatement(undefined, code, filter);
  },

  clearMemoryForTesting(): void {
    clearMemoryLedgerForTesting();
  },
};
