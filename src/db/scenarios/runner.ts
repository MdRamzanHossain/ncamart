import { ledgerService } from "@/modules/ledger";
import { runCodFirstTimeScenario } from "./cod-first-time";
import { runPreorderFullCycleScenario } from "./preorder-full-cycle";
import { runRtoScenario } from "./rto";
import { runRmaDoaScenario } from "./rma-doa";
import { runWalkInScenario } from "./walk-in";
import { printTrialBalanceTable, ScenarioResult } from "./types";

export const SCENARIOS: Record<string, () => Promise<ScenarioResult>> = {
  "cod-first-time": runCodFirstTimeScenario,
  "preorder-full-cycle": runPreorderFullCycleScenario,
  rto: runRtoScenario,
  "rma-doa": runRmaDoaScenario,
  "walk-in": runWalkInScenario,
};

export async function runScenarioByName(scenarioName?: string): Promise<void> {
  const selected = scenarioName?.toLowerCase().trim();

  if (!selected || selected === "--help" || selected === "-h") {
    console.log(`
Usage:
  pnpm dev:scenario <name>

Available Scenarios:
  - cod-first-time      : First-time COD buyer, advance fee, courier delivery & revenue recognition
  - preorder-full-cycle : Pre-order deposit, customs arrival, balance payment & fulfillment
  - rto                 : Courier delivery refusal, return-to-origin receipt, advance retention
  - rma-doa             : Dead-on-arrival claim with unboxing video, replacement order & write-off
  - walk-in             : Showroom POS cash counter sale with active seal & thermal receipt
  - all                 : Run all five scenarios sequentially

Example:
  pnpm dev:scenario cod-first-time
`);
    process.exit(0);
  }

  // Ensure Chart of Accounts is initialized
  await ledgerService.seedChartOfAccounts();

  if (selected === "all") {
    console.log("\n========================================================");
    console.log("       Running All 5 NCAMart End-to-End Scenarios       ");
    console.log("========================================================\n");

    for (const [name, fn] of Object.entries(SCENARIOS)) {
      console.log(`\n>>> Running scenario: [${name}]`);
      const result = await fn();
      for (const ev of result.eventsExecuted) {
        console.log(`  ${ev}`);
      }
      console.log(`  Total Journal Entries Posted: ${result.journalEntriesPosted}`);
    }

    const finalTb = await ledgerService.getTrialBalance();
    printTrialBalanceTable(finalTb);
    console.log(`All scenarios completed successfully! Ledger is balanced: ${finalTb.isBalanced}\n`);
    return;
  }

  const fn = SCENARIOS[selected];
  if (!fn) {
    console.error(`\nUnknown scenario: '${selected}'. Run 'pnpm dev:scenario --help' for list of scenarios.\n`);
    process.exit(1);
  }

  console.log(`\n========================================================`);
  console.log(` Running Scenario: [${selected}] `);
  console.log(`========================================================\n`);

  const result = await fn();

  console.log("Events Timeline:");
  for (const ev of result.eventsExecuted) {
    console.log(`  ${ev}`);
  }
  console.log(`\nJournal Entries Posted: ${result.journalEntriesPosted}`);

  printTrialBalanceTable(result.trialBalance);

  if (!result.trialBalance.isBalanced) {
    console.error("ERROR: Trial balance is NOT balanced! Sum of debits != sum of credits.");
    process.exit(1);
  }

  console.log(`Scenario [${selected}] completed successfully. Trial balance is verified balanced!\n`);
}

if (process.argv[1]?.includes("runner.ts")) {
  const targetScenario = process.argv[2];
  runScenarioByName(targetScenario)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Scenario execution failed:", err);
      process.exit(1);
    });
}
