import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import {
  ledgerAccounts,
  journalEntries,
  journalLines,
  LedgerAccountRow,
  JournalEntryRow,
  InsertJournalEntryRow,
  JournalLineRow,
  InsertJournalLineRow,
} from "./schema";
import {
  CHART_OF_ACCOUNTS,
} from "./accounts";
import {
  ListJournalEntriesFilterDto,
  AccountStatementFilterDto,
  TrialBalanceSummary,
  AccountStatementSummary,
} from "./dto";

// In-Memory Fallback Stores for Isolated Unit Tests & Mock Dev
const memAccounts = new Map<string, LedgerAccountRow>();
const memEntries = new Map<string, JournalEntryRow>();
const memLines = new Map<string, JournalLineRow>();

function initializeMemoryAccounts(): void {
  if (memAccounts.size === 0) {
    for (const def of CHART_OF_ACCOUNTS) {
      const row: LedgerAccountRow = {
        id: crypto.randomUUID(),
        code: def.code,
        name: def.name,
        type: def.type,
        normalSide: def.normalSide,
        isContra: def.isContra,
        requiresSubLedger: def.requiresSubLedger,
        createdAt: new Date(),
      };
      memAccounts.set(def.code, row);
    }
  }
}

initializeMemoryAccounts();

export function clearMemoryLedgerForTesting(): void {
  memEntries.clear();
  memLines.clear();
  memAccounts.clear();
  initializeMemoryAccounts();
}

export const ledgerRepo = {
  // --------------------------------------------------------------------------
  // Accounts
  // --------------------------------------------------------------------------
  async seedAccountsIfEmpty(tx?: Tx): Promise<void> {
    const client = tx ?? defaultDb;
    try {
      for (const def of CHART_OF_ACCOUNTS) {
        await client
          .insert(ledgerAccounts)
          .values({
            id: crypto.randomUUID(),
            code: def.code,
            name: def.name,
            type: def.type,
            normalSide: def.normalSide,
            isContra: def.isContra,
            requiresSubLedger: def.requiresSubLedger,
            createdAt: new Date(),
          })
          .onConflictDoNothing({ target: ledgerAccounts.code });
      }
    } catch {
      initializeMemoryAccounts();
    }
  },

  async getAccountByCode(tx: Tx | undefined, code: string): Promise<LedgerAccountRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.code, code))
        .limit(1);
      if (row) return row;
    } catch {
      // Fallback
    }

    return memAccounts.get(code) ?? null;
  },

  async getAccountById(tx: Tx | undefined, id: string): Promise<LedgerAccountRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Fallback
    }

    for (const acc of memAccounts.values()) {
      if (acc.id === id) return acc;
    }
    return null;
  },

  async listAccounts(tx?: Tx): Promise<LedgerAccountRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(ledgerAccounts)
        .orderBy(ledgerAccounts.code);
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }

    return Array.from(memAccounts.values()).sort((a, b) => a.code.localeCompare(b.code));
  },

  // --------------------------------------------------------------------------
  // Journal Entries & Lines
  // --------------------------------------------------------------------------
  async getEntryById(
    tx: Tx | undefined,
    id: string
  ): Promise<(JournalEntryRow & { lines: (JournalLineRow & { accountCode: string; accountName: string })[] }) | null> {
    const client = tx ?? defaultDb;
    try {
      const [entry] = await client
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.id, id))
        .limit(1);
      if (entry) {
        const lines = await client
          .select({
            line: journalLines,
            account: ledgerAccounts,
          })
          .from(journalLines)
          .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
          .where(eq(journalLines.entryId, entry.id));

        return {
          ...entry,
          lines: lines.map((l) => ({
            ...l.line,
            accountCode: l.account.code,
            accountName: l.account.name,
          })),
        };
      }
    } catch {
      // Fallback
    }

    const memEntry = memEntries.get(id);
    if (!memEntry) return null;

    const lines: (JournalLineRow & { accountCode: string; accountName: string })[] = [];
    for (const l of memLines.values()) {
      if (l.entryId === id) {
        let accountCode = "";
        let accountName = "";
        for (const a of memAccounts.values()) {
          if (a.id === l.accountId) {
            accountCode = a.code;
            accountName = a.name;
            break;
          }
        }
        lines.push({ ...l, accountCode, accountName });
      }
    }

    return { ...memEntry, lines };
  },

  async getEntryByEventIdempotency(
    tx: Tx | undefined,
    eventType: string,
    sourceType: string,
    sourceId: string
  ): Promise<JournalEntryRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [entry] = await client
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.eventType, eventType),
            eq(journalEntries.sourceType, sourceType),
            eq(journalEntries.sourceId, sourceId)
          )
        )
        .limit(1);
      if (entry) return entry;
    } catch {
      // Fallback
    }

    for (const e of memEntries.values()) {
      if (
        e.eventType === eventType &&
        e.sourceType === sourceType &&
        e.sourceId === sourceId
      ) {
        return e;
      }
    }
    return null;
  },

  async createEntry(
    tx: Tx | undefined,
    entryRow: InsertJournalEntryRow,
    lineRows: InsertJournalLineRow[]
  ): Promise<JournalEntryRow & { lines: JournalLineRow[] }> {
    const client = tx ?? defaultDb;
    try {
      const [created] = await client
        .insert(journalEntries)
        .values(entryRow)
        .returning();

      if (!created) {
        throw new Error("Failed to insert journal entry");
      }

      const createdLines = await client
        .insert(journalLines)
        .values(lineRows)
        .returning();

      return { ...created, lines: createdLines };
    } catch (err) {
      // If PostgreSQL throws balanced trigger or uniqueness or foreign key error, rethrow
      if (
        err instanceof Error &&
        (err.message.includes("Unbalanced journal entry") ||
          err.message.includes("violates check constraint") ||
          err.message.includes("duplicate key value"))
      ) {
        throw err;
      }
    }

    // Memory Fallback
    // Validate balance in memory
    const totalDebit = lineRows.reduce((acc, l) => acc + (l.debitPaisa ?? 0), 0);
    const totalCredit = lineRows.reduce((acc, l) => acc + (l.creditPaisa ?? 0), 0);
    if (totalDebit !== totalCredit) {
      throw new Error(`Unbalanced journal entry ${entryRow.id}`);
    }

    // Validate one-side check
    for (const line of lineRows) {
      const d = line.debitPaisa ?? 0;
      const c = line.creditPaisa ?? 0;
      if (d < 0 || c < 0 || (d === 0) === (c === 0)) {
        throw new Error("Each line must be one-sided with positive amount");
      }
    }

    const savedEntry: JournalEntryRow = {
      id: entryRow.id ?? crypto.randomUUID(),
      entryNumber: entryRow.entryNumber,
      eventType: entryRow.eventType,
      sourceType: entryRow.sourceType,
      sourceId: entryRow.sourceId,
      description: entryRow.description,
      postedAt: entryRow.postedAt ?? new Date(),
      postedByType: entryRow.postedByType,
      postedById: entryRow.postedById ?? null,
      reversalOf: entryRow.reversalOf ?? null,
      createdAt: new Date(),
    };
    memEntries.set(savedEntry.id, savedEntry);

    const savedLines: JournalLineRow[] = [];
    for (const l of lineRows) {
      const savedLine: JournalLineRow = {
        id: l.id ?? crypto.randomUUID(),
        entryId: savedEntry.id,
        accountId: l.accountId,
        subLedgerType: l.subLedgerType ?? null,
        subLedgerRef: l.subLedgerRef ?? null,
        debitPaisa: l.debitPaisa ?? 0,
        creditPaisa: l.creditPaisa ?? 0,
        createdAt: new Date(),
      };
      memLines.set(savedLine.id, savedLine);
      savedLines.push(savedLine);
    }

    return { ...savedEntry, lines: savedLines };
  },

  async listEntries(
    tx: Tx | undefined,
    filter: ListJournalEntriesFilterDto
  ): Promise<{ items: (JournalEntryRow & { linesCount: number; totalPaisa: number })[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const offset = (page - 1) * limit;

    const client = tx ?? defaultDb;
    try {
      const conditions = [];
      if (filter.eventType) conditions.push(eq(journalEntries.eventType, filter.eventType));
      if (filter.sourceType) conditions.push(eq(journalEntries.sourceType, filter.sourceType));
      if (filter.sourceId) conditions.push(eq(journalEntries.sourceId, filter.sourceId));
      if (filter.from) conditions.push(sql`${journalEntries.postedAt} >= ${filter.from}`);
      if (filter.to) conditions.push(sql`${journalEntries.postedAt} <= ${filter.to}`);

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(journalEntries)
        .where(whereClause);
      const total = Number(countRes?.count ?? 0);

      const rows = await client
        .select()
        .from(journalEntries)
        .where(whereClause)
        .orderBy(desc(journalEntries.postedAt))
        .limit(limit)
        .offset(offset);

      const items = await Promise.all(
        rows.map(async (row) => {
          const lines = await client
            .select({
              debitPaisa: journalLines.debitPaisa,
            })
            .from(journalLines)
            .where(eq(journalLines.entryId, row.id));

          const totalPaisa = lines.reduce((sum, l) => sum + Number(l.debitPaisa), 0);
          return {
            ...row,
            linesCount: lines.length,
            totalPaisa,
          };
        })
      );

      if (items.length > 0 || total > 0) {
        return { items, total };
      }
    } catch {
      // Fallback
    }

    let all = Array.from(memEntries.values());
    if (filter.eventType) all = all.filter((e) => e.eventType === filter.eventType);
    if (filter.sourceType) all = all.filter((e) => e.sourceType === filter.sourceType);
    if (filter.sourceId) all = all.filter((e) => e.sourceId === filter.sourceId);
    if (filter.from) all = all.filter((e) => e.postedAt >= filter.from!);
    if (filter.to) all = all.filter((e) => e.postedAt <= filter.to!);

    all.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
    const total = all.length;
    const paginated = all.slice(offset, offset + limit);

    const items = paginated.map((row) => {
      let linesCount = 0;
      let totalPaisa = 0;
      for (const l of memLines.values()) {
        if (l.entryId === row.id) {
          linesCount++;
          totalPaisa += l.debitPaisa;
        }
      }
      return {
        ...row,
        linesCount,
        totalPaisa,
      };
    });

    return { items, total };
  },

  // --------------------------------------------------------------------------
  // Financial Queries: Balances & Statements
  // --------------------------------------------------------------------------
  async getAccountBalance(
    tx: Tx | undefined,
    code: string,
    asOf?: Date,
    subLedgerRef?: string
  ): Promise<{ account: LedgerAccountRow; debitPaisa: number; creditPaisa: number; netBalancePaisa: number }> {
    const account = await this.getAccountByCode(tx, code);
    if (!account) {
      throw new Error(`Account code '${code}' not found`);
    }

    const client = tx ?? defaultDb;
    try {
      const conditions = [
        eq(journalLines.accountId, account.id),
      ];
      if (asOf) {
        conditions.push(sql`${journalEntries.postedAt} <= ${asOf}`);
      }
      if (subLedgerRef) {
        conditions.push(eq(journalLines.subLedgerRef, subLedgerRef));
      }

      const [res] = await client
        .select({
          totalDebit: sql<number>`coalesce(sum(${journalLines.debitPaisa}), 0)`,
          totalCredit: sql<number>`coalesce(sum(${journalLines.creditPaisa}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(...conditions));

      const debitPaisa = Number(res?.totalDebit ?? 0);
      const creditPaisa = Number(res?.totalCredit ?? 0);

      // Normal side determines sign of net balance
      const isDebitNormal = account.normalSide === "DEBIT";
      const netBalancePaisa = isDebitNormal
        ? debitPaisa - creditPaisa
        : creditPaisa - debitPaisa;

      return { account, debitPaisa, creditPaisa, netBalancePaisa };
    } catch {
      // Fallback
    }

    let debitPaisa = 0;
    let creditPaisa = 0;

    for (const line of memLines.values()) {
      if (line.accountId !== account.id) continue;
      if (subLedgerRef && line.subLedgerRef !== subLedgerRef) continue;

      const entry = memEntries.get(line.entryId);
      if (!entry) continue;
      if (asOf && entry.postedAt > asOf) continue;

      debitPaisa += line.debitPaisa;
      creditPaisa += line.creditPaisa;
    }

    const isDebitNormal = account.normalSide === "DEBIT";
    const netBalancePaisa = isDebitNormal
      ? debitPaisa - creditPaisa
      : creditPaisa - debitPaisa;

    return { account, debitPaisa, creditPaisa, netBalancePaisa };
  },

  async getTrialBalance(tx: Tx | undefined, asOf = new Date()): Promise<TrialBalanceSummary> {
    const accounts = await this.listAccounts(tx);
    const client = tx ?? defaultDb;

    const accountSummaries: TrialBalanceSummary["accounts"] = [];
    let grandDebitsPaisa = 0;
    let grandCreditsPaisa = 0;

    for (const acc of accounts) {
      let debitPaisa = 0;
      let creditPaisa = 0;

      try {
        const [res] = await client
          .select({
            totalDebit: sql<number>`coalesce(sum(${journalLines.debitPaisa}), 0)`,
            totalCredit: sql<number>`coalesce(sum(${journalLines.creditPaisa}), 0)`,
          })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(
            and(
              eq(journalLines.accountId, acc.id),
              sql`${journalEntries.postedAt} <= ${asOf}`
            )
          );

        debitPaisa = Number(res?.totalDebit ?? 0);
        creditPaisa = Number(res?.totalCredit ?? 0);
      } catch {
        for (const line of memLines.values()) {
          if (line.accountId !== acc.id) continue;
          const entry = memEntries.get(line.entryId);
          if (!entry || entry.postedAt > asOf) continue;

          debitPaisa += line.debitPaisa;
          creditPaisa += line.creditPaisa;
        }
      }

      const net = debitPaisa - creditPaisa;
      let displayDebit = 0;
      let displayCredit = 0;

      if (net > 0) {
        displayDebit = net;
      } else if (net < 0) {
        displayCredit = Math.abs(net);
      }

      accountSummaries.push({
        code: acc.code,
        name: acc.name,
        debit_paisa: displayDebit,
        credit_paisa: displayCredit,
      });

      grandDebitsPaisa += displayDebit;
      grandCreditsPaisa += displayCredit;
    }

    const isBalanced = grandDebitsPaisa === grandCreditsPaisa;
    return {
      as_of_date: asOf.toISOString(),
      accounts: accountSummaries,
      total_debits_paisa: grandDebitsPaisa,
      total_credits_paisa: grandCreditsPaisa,
      is_balanced: isBalanced,
      totalDebitPaisa: grandDebitsPaisa,
      totalCreditPaisa: grandCreditsPaisa,
      isBalanced: isBalanced,
    };
  },

  async getAccountStatement(
    tx: Tx | undefined,
    code: string,
    filter: AccountStatementFilterDto = {}
  ): Promise<AccountStatementSummary> {
    const account = await this.getAccountByCode(tx, code);
    if (!account) {
      throw new Error(`Account code '${code}' not found`);
    }

    const asOf = filter?.to ?? new Date();
    const from = filter?.from ?? new Date(0);
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const offset = (page - 1) * limit;

    // 1. Opening balance before 'from'
    const opening = await this.getAccountBalance(tx, code, new Date(from.getTime() - 1), filter?.subLedgerRef);
    const openingBalancePaisa = opening.netBalancePaisa;

    // 2. Lines within range
    const client = tx ?? defaultDb;
    let statementItems: AccountStatementSummary["items"] = [];
    let total = 0;
    let periodDebits = 0;
    let periodCredits = 0;

    try {
      const conditions = [
        eq(journalLines.accountId, account.id),
        sql`${journalEntries.postedAt} >= ${from}`,
        sql`${journalEntries.postedAt} <= ${asOf}`,
      ];
      if (filter.subLedgerRef) {
        conditions.push(eq(journalLines.subLedgerRef, filter.subLedgerRef));
      }

      const [countRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(...conditions));
      total = Number(countRes?.count ?? 0);

      const rows = await client
        .select({
          line: journalLines,
          entry: journalEntries,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(...conditions))
        .orderBy(desc(journalEntries.postedAt))
        .limit(limit)
        .offset(offset);

      statementItems = rows.map((r) => ({
        id: r.line.id,
        entryId: r.entry.id,
        entryNumber: r.entry.entryNumber,
        eventType: r.entry.eventType,
        postedAt: r.entry.postedAt.toISOString(),
        description: r.entry.description,
        debitPaisa: r.line.debitPaisa,
        creditPaisa: r.line.creditPaisa,
        subLedgerType: r.line.subLedgerType,
        subLedgerRef: r.line.subLedgerRef,
      }));

      for (const row of rows) {
        periodDebits += row.line.debitPaisa;
        periodCredits += row.line.creditPaisa;
      }
    } catch {
      const matchedLines: { line: JournalLineRow; entry: JournalEntryRow }[] = [];
      for (const l of memLines.values()) {
        if (l.accountId !== account.id) continue;
        if (filter.subLedgerRef && l.subLedgerRef !== filter.subLedgerRef) continue;

        const entry = memEntries.get(l.entryId);
        if (!entry) continue;
        if (entry.postedAt < from || entry.postedAt > asOf) continue;

        matchedLines.push({ line: l, entry });
        periodDebits += l.debitPaisa;
        periodCredits += l.creditPaisa;
      }

      matchedLines.sort((a, b) => b.entry.postedAt.getTime() - a.entry.postedAt.getTime());
      total = matchedLines.length;
      statementItems = matchedLines.slice(offset, offset + limit).map((r) => ({
        id: r.line.id,
        entryId: r.entry.id,
        entryNumber: r.entry.entryNumber,
        eventType: r.entry.eventType,
        postedAt: r.entry.postedAt.toISOString(),
        description: r.entry.description,
        debitPaisa: r.line.debitPaisa,
        creditPaisa: r.line.creditPaisa,
        subLedgerType: r.line.subLedgerType,
        subLedgerRef: r.line.subLedgerRef,
      }));
    }

    // 3. Closing balance as of 'asOf'
    const closing = await this.getAccountBalance(tx, code, asOf, filter.subLedgerRef);
    const closingBalancePaisa = closing.netBalancePaisa;

    return {
      account: {
        code: account.code,
        name: account.name,
        type: account.type,
        normalSide: account.normalSide,
        isContra: account.isContra,
      },
      asOf: asOf.toISOString(),
      openingBalancePaisa,
      closingBalancePaisa,
      netBalancePaisa: closingBalancePaisa,
      items: statementItems,
      totalDebitsPaisa: periodDebits,
      totalCreditsPaisa: periodCredits,
      debitPaisa: periodDebits,
      creditPaisa: periodCredits,
      total,
    };
  },

  async getSubLedgerBalances(
    tx: Tx | undefined,
    accountCode: string,
    asOf = new Date()
  ): Promise<{ subLedgerRef: string; debitPaisa: number; creditPaisa: number; netBalancePaisa: number }[]> {
    const account = await this.getAccountByCode(tx, accountCode);
    if (!account) {
      throw new Error(`Account code '${accountCode}' not found`);
    }

    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select({
          subLedgerRef: journalLines.subLedgerRef,
          totalDebit: sql<number>`coalesce(sum(${journalLines.debitPaisa}), 0)`,
          totalCredit: sql<number>`coalesce(sum(${journalLines.creditPaisa}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(
          and(
            eq(journalLines.accountId, account.id),
            sql`${journalEntries.postedAt} <= ${asOf}`,
            sql`${journalLines.subLedgerRef} IS NOT NULL`
          )
        )
        .groupBy(journalLines.subLedgerRef);

      const isDebitNormal = account.normalSide === "DEBIT";
      return rows.map((r) => {
        const debitPaisa = Number(r.totalDebit);
        const creditPaisa = Number(r.totalCredit);
        const netBalancePaisa = isDebitNormal ? debitPaisa - creditPaisa : creditPaisa - debitPaisa;
        return {
          subLedgerRef: r.subLedgerRef ?? "",
          debitPaisa,
          creditPaisa,
          netBalancePaisa,
        };
      });
    } catch {
      // Fallback
    }

    const map = new Map<string, { debit: number; credit: number }>();
    for (const l of memLines.values()) {
      if (l.accountId !== account.id || !l.subLedgerRef) continue;
      const entry = memEntries.get(l.entryId);
      if (!entry || entry.postedAt > asOf) continue;

      const current = map.get(l.subLedgerRef) ?? { debit: 0, credit: 0 };
      current.debit += l.debitPaisa;
      current.credit += l.creditPaisa;
      map.set(l.subLedgerRef, current);
    }

    const isDebitNormal = account.normalSide === "DEBIT";
    return Array.from(map.entries()).map(([ref, b]) => {
      const netBalancePaisa = isDebitNormal ? b.debit - b.credit : b.credit - b.debit;
      return {
        subLedgerRef: ref,
        debitPaisa: b.debit,
        creditPaisa: b.credit,
        netBalancePaisa,
      };
    });
  },
};
