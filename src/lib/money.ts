/**
 * Money helpers. All amounts are integer paisa (1 BDT = 100 paisa). No floating point.
 * Internally uses BigInt wherever an intermediate product could exceed 2^53.
 */
import { ValidationError } from "./errors";

declare const paisaBrand: unique symbol;
/** Integer amount in paisa. Use assertPaisa / toPaisa to create one. */
export type Paisa = number & { readonly [paisaBrand]: true };

export type Rounding = "up" | "down" | "half_up";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new ValidationError(`${label} must be a safe integer`, { value });
  }
}

/** Asserts a non-negative safe integer and brands it as Paisa. */
export function assertPaisa(value: number): Paisa {
  assertSafeInteger(value, "Paisa amount");
  if (value < 0) throw new ValidationError("Paisa amount must be non-negative", { value });
  return value as Paisa;
}

/** Brands a (possibly negative) safe integer as Paisa — for deltas / ledger signed amounts. */
export function toSignedPaisa(value: number): Paisa {
  assertSafeInteger(value, "Paisa amount");
  return value as Paisa;
}

function fromBigInt(value: bigint): Paisa {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new ValidationError("Paisa amount overflows safe integer range", { value: value.toString() });
  }
  return Number(value) as Paisa;
}

/**
 * Converts taka to paisa without floats.
 * Accepts an integer number of taka (e.g. 1200) or a decimal string with up to 2 fraction digits
 * (e.g. "1200.5", "1,200.50"). Rejects anything else.
 */
export function takaToPaisa(taka: number | string): Paisa {
  if (typeof taka === "number") {
    if (!Number.isSafeInteger(taka)) {
      throw new ValidationError("Numeric taka must be an integer; pass decimals as a string", { taka });
    }
    return assertPaisa(fromBigInt(BigInt(taka) * 100n));
  }
  const cleaned = taka.trim().replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new ValidationError("Invalid taka amount", { taka });
  const whole = BigInt(match[1] ?? "0");
  const frac = BigInt((match[2] ?? "").padEnd(2, "0"));
  return assertPaisa(fromBigInt(whole * 100n + frac));
}

function groupThousands(digits: string): string {
  // TODO-CONFIRM: Western 3-digit grouping. BD often uses lakh grouping (12,34,567); confirm with business.
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function toBanglaDigits(s: string): string {
  return s.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Formats paisa as "৳1,200.00" (en) or "৳১,২০০.০০" (bn). Negative amounts get a leading "-". */
export function paisaToTakaString(paisa: number, locale: "en" | "bn" = "en"): string {
  assertSafeInteger(paisa, "Paisa amount");
  const negative = paisa < 0;
  const abs = BigInt(Math.abs(paisa));
  const whole = (abs / 100n).toString();
  const frac = (abs % 100n).toString().padStart(2, "0");
  let out = `${groupThousands(whole)}.${frac}`;
  if (locale === "bn") out = toBanglaDigits(out);
  return `${negative ? "-" : ""}৳${out}`;
}

export function addPaisa(a: Paisa, b: Paisa): Paisa {
  return fromBigInt(BigInt(a) + BigInt(b));
}

export function subtractPaisa(a: Paisa, b: Paisa): Paisa {
  return fromBigInt(BigInt(a) - BigInt(b));
}

export function sumPaisa(values: readonly Paisa[]): Paisa {
  let total = 0n;
  for (const v of values) total += BigInt(v);
  return fromBigInt(total);
}

/** Integer division of non-negative bigints with the requested rounding. */
export function divRound(numerator: bigint, denominator: bigint, rounding: Rounding): bigint {
  if (denominator <= 0n) throw new ValidationError("Denominator must be positive");
  if (numerator < 0n) throw new ValidationError("Numerator must be non-negative");
  const q = numerator / denominator;
  const r = numerator % denominator;
  if (r === 0n) return q;
  switch (rounding) {
    case "down":
      return q;
    case "up":
      return q + 1n;
    case "half_up":
      return r * 2n >= denominator ? q + 1n : q;
  }
}

/** Rounds paisa UP to the next multiple of `takaStep` taka (e.g. step 10 → nearest ৳10 above). */
export function roundUpToTaka(paisa: Paisa, takaStep = 1): Paisa {
  assertPaisa(paisa);
  if (!Number.isSafeInteger(takaStep) || takaStep <= 0) {
    throw new ValidationError("takaStep must be a positive integer", { takaStep });
  }
  const step = BigInt(takaStep) * 100n;
  return fromBigInt(divRound(BigInt(paisa), step, "up") * step);
}

/** Percentage of an amount where the percentage is given in basis points (750 bp = 7.5%). */
export function pctOfPaisa(paisa: Paisa, bp: number, rounding: Rounding = "half_up"): Paisa {
  assertPaisa(paisa);
  if (!Number.isSafeInteger(bp) || bp < 0) {
    throw new ValidationError("Basis points must be a non-negative integer", { bp });
  }
  return fromBigInt(divRound(BigInt(paisa) * BigInt(bp), 10_000n, rounding));
}
