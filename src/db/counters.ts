import { sql } from "drizzle-orm";
import { Tx } from "@/lib/db";
import {
  formatOrderNumber,
  formatRmaNumber,
  formatRunnerTaskNumber,
  formatRefundNumber,
  formatJournalNumber,
  formatInvoiceNumber,
} from "@/lib/ids";
import { toDhaka, fiscalYearOf } from "@/lib/time";

// In-memory counter store for mock mode or tests without an active database connection
const memCounters = new Map<string, bigint>();

/**
 * Generate the next gapless sequential number for a given scope and period.
 * Uses atomic INSERT ... ON CONFLICT DO UPDATE SET last_no = last_no + 1 RETURNING last_no.
 */
export async function nextNumber(
  tx: Tx | null,
  scope: string,
  period: string
): Promise<bigint> {
  if (!tx) {
    const key = `${scope}:${period}`;
    const nextVal = (memCounters.get(key) ?? 0n) + 1n;
    memCounters.set(key, nextVal);
    return nextVal;
  }

  const result = await tx.execute<{ last_no: string | number | bigint }>(
    sql`
      INSERT INTO number_counters (scope, period, last_no)
      VALUES (${scope}, ${period}, 1)
      ON CONFLICT (scope, period)
      DO UPDATE SET last_no = number_counters.last_no + 1
      RETURNING last_no;
    `
  );

  const rawLastNo = result.rows[0]?.last_no;
  if (rawLastNo === undefined || rawLastNo === null) {
    throw new Error(`Failed to advance counter for scope ${scope} and period ${period}`);
  }

  return BigInt(rawLastNo);
}

/** Reset in-memory counters for clean test isolation */
export function clearMemoryCountersForTesting(): void {
  memCounters.clear();
}

/** Generate next order number: ORD-YYYY-NNNNN */
export async function generateOrderNumber(
  tx: Tx | null,
  date: Date = new Date()
): Promise<string> {
  const dhaka = toDhaka(date);
  const period = String(dhaka.year);
  const seq = await nextNumber(tx, "ORDER", period);
  return formatOrderNumber(dhaka.year, Number(seq));
}

/** Generate next RMA number: RMA-YYYY-NNNN */
export async function generateRmaNumber(
  tx: Tx | null,
  date: Date = new Date()
): Promise<string> {
  const dhaka = toDhaka(date);
  const period = String(dhaka.year);
  const seq = await nextNumber(tx, "RMA", period);
  return formatRmaNumber(dhaka.year, Number(seq));
}

/** Generate next runner task number: RUN-YYYYMMDD-NNNN */
export async function generateRunnerNumber(
  tx: Tx | null,
  date: Date = new Date()
): Promise<string> {
  const dhaka = toDhaka(date);
  const dateKey = `${dhaka.year}${String(dhaka.month).padStart(2, "0")}${String(dhaka.day).padStart(2, "0")}`;
  const seq = await nextNumber(tx, "RUNNER", dateKey);
  return formatRunnerTaskNumber(dateKey, Number(seq));
}

/** Generate next refund number: REF-YYYY-NNNNN */
export async function generateRefundNumber(
  tx: Tx | null,
  date: Date = new Date()
): Promise<string> {
  const dhaka = toDhaka(date);
  const period = String(dhaka.year);
  const seq = await nextNumber(tx, "REFUND", period);
  return formatRefundNumber(dhaka.year, Number(seq));
}

/** Generate next journal entry number: JRN-YYYYMMDD-NNNNN */
export async function generateJournalNumber(
  tx: Tx | null,
  date: Date = new Date()
): Promise<string> {
  const dhaka = toDhaka(date);
  const dateKey = `${dhaka.year}${String(dhaka.month).padStart(2, "0")}${String(dhaka.day).padStart(2, "0")}`;
  const seq = await nextNumber(tx, "JOURNAL", dateKey);
  return formatJournalNumber(dateKey, Number(seq));
}

/** Generate next Mushak 6.3 VAT invoice serial: MUSHAK-6.3-YYYY-YYYY-NNNNNN */
export async function generateMushakNumber(
  tx: Tx | null,
  date: Date = new Date()
): Promise<string> {
  const period = fiscalYearOf(date);
  const seq = await nextNumber(tx, "MUSHAK_6_3", period);
  return `MUSHAK-6.3-${period}-${String(seq).padStart(6, "0")}`;
}

/** Generate next system invoice number: INV-YYYY-NNNNN */
export async function generateInvoiceNumber(
  tx: Tx | null,
  date: Date = new Date()
): Promise<string> {
  const dhaka = toDhaka(date);
  const period = String(dhaka.year);
  const seq = await nextNumber(tx, "INVOICE", period);
  return formatInvoiceNumber(dhaka.year, Number(seq));
}
