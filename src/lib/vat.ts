/**
 * VAT split for VAT-inclusive prices (PRD §3.6.4: displayed prices are VAT-inclusive).
 * vat = round_half_up(gross * rateBp / (10000 + rateBp)); net = gross - vat.
 */
import { assertPaisa, divRound, type Paisa } from "./money";
import { ValidationError } from "./errors";

export interface VatSplit {
  netPaisa: Paisa;
  vatPaisa: Paisa;
}

export function vatFromInclusive(grossPaisa: Paisa, rateBp: number): VatSplit {
  assertPaisa(grossPaisa);
  if (!Number.isSafeInteger(rateBp) || rateBp < 0) {
    throw new ValidationError("VAT rate must be a non-negative integer in basis points", { rateBp });
  }
  const gross = BigInt(grossPaisa);
  const rate = BigInt(rateBp);
  const vat = divRound(gross * rate, 10_000n + rate, "half_up");
  return {
    vatPaisa: assertPaisa(Number(vat)),
    netPaisa: assertPaisa(Number(gross - vat)),
  };
}
