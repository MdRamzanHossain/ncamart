import { TrialBalanceSummary } from "@/modules/ledger/dto";

export interface ScenarioResult {
  name: string;
  description: string;
  eventsExecuted: string[];
  journalEntriesPosted: number;
  trialBalance: TrialBalanceSummary;
}

export function formatCurrencyBDT(paisa: number): string {
  const taka = paisa / 100;
  return `৳${taka.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getAccountTypeFromCode(code: string): string {
  if (code.startsWith("1")) return "ASSET";
  if (code.startsWith("2")) return "LIABILITY";
  if (code.startsWith("3")) return "EQUITY";
  if (code.startsWith("4")) return "REVENUE";
  if (code.startsWith("5")) return "EXPENSE";
  return "OTHER";
}

export function printTrialBalanceTable(tb: TrialBalanceSummary): void {
  console.log("\n==========================================================================================");
  console.log("                                 TRIAL BALANCE SUMMARY                                    ");
  console.log("==========================================================================================");
  console.log("| Code | Account Name                          | Type       | Debit (BDT)    | Credit (BDT)   |");
  console.log("|------|---------------------------------------|------------|----------------|----------------|");

  for (const acc of tb.accounts) {
    const debit = (acc as any).debitPaisa ?? acc.debit_paisa ?? 0;
    const credit = (acc as any).creditPaisa ?? acc.credit_paisa ?? 0;
    if (debit === 0 && credit === 0) continue;

    const accType = (acc as any).type ?? getAccountTypeFromCode(acc.code);
    const debitStr = debit > 0 ? formatCurrencyBDT(debit).padStart(14) : "".padStart(14);
    const creditStr = credit > 0 ? formatCurrencyBDT(credit).padStart(14) : "".padStart(14);
    console.log(
      `| ${acc.code.padEnd(4)} | ${acc.name.padEnd(37)} | ${accType.padEnd(10)} | ${debitStr} | ${creditStr} |`
    );
  }

  console.log("|------|---------------------------------------|------------|----------------|----------------|");
  const totalDebit = tb.totalDebitPaisa ?? tb.total_debits_paisa ?? 0;
  const totalCredit = tb.totalCreditPaisa ?? tb.total_credits_paisa ?? 0;
  const isBalanced = tb.isBalanced ?? tb.is_balanced ?? false;

  const totalDebitStr = formatCurrencyBDT(totalDebit).padStart(14);
  const totalCreditStr = formatCurrencyBDT(totalCredit).padStart(14);
  console.log(
    `| TOTAL| Balanced Ledger Invariant: ${isBalanced ? "VALID (OK)" : "MISMATCH"}`.padEnd(56) +
      `| ${totalDebitStr} | ${totalCreditStr} |`
  );
  console.log("==========================================================================================\n");
}
