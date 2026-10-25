/**
 * RFC 4180 compliant CSV parser and per-courier/gateway column mappers.
 * Zero external runtime dependencies.
 */

export interface ParsedCsvRow {
  [header: string]: string;
}

/**
 * Parses raw CSV text into a 2D array of trimmed string values,
 * correctly handling quotes, escaped quotes (""), commas inside quotes,
 * and Windows/Unix newlines.
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;
  let i = 0;

  const len = csvText.length;
  while (i < len) {
    const char = csvText[i];

    if (insideQuotes) {
      if (char === '"') {
        if (i + 1 < len && csvText[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
        continue;
      } else if (char === "\r") {
        if (i + 1 < len && csvText[i + 1] === "\n") {
          i++; // Skip \r in \r\n
        }
        currentRow.push(currentField.trim());
        currentField = "";
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        currentField = "";
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Final field and row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses CSV text into an array of objects keyed by the header line.
 */
export function parseCsv(csvText: string): ParsedCsvRow[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim().replace(/[\s\-_]+/g, "_"));
  const dataRows: ParsedCsvRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const rowValues = rows[r];
    const rowObj: ParsedCsvRow = {};
    for (let h = 0; h < headers.length; h++) {
      rowObj[headers[h]] = rowValues[h] ?? "";
    }
    dataRows.push(rowObj);
  }

  return dataRows;
}

/**
 * Converts a raw amount value to integer paisa.
 * - If header ends with / includes 'paisa', value is treated as integer paisa.
 * - Otherwise, value is treated as BDT Taka and multiplied by 100.
 */
export function parseAmountToPaisa(val: unknown, headerKey = ""): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") {
    if (headerKey.includes("paisa")) return Math.round(val);
    return Math.round(val * 100);
  }

  const clean = String(val).replace(/[^0-9.-]/g, "").trim();
  if (!clean) return 0;

  const num = parseFloat(clean);
  if (Number.isNaN(num)) return 0;

  if (headerKey.includes("paisa")) {
    return Math.round(num);
  }

  // If decimal dot is present or standard Taka representation, convert Taka -> Paisa
  return Math.round(num * 100);
}

export interface CourierColumnMapping {
  consignmentNo: string[];
  collectedAmount: string[];
  deliveryCharge: string[];
  codCharge: string[];
  returnCharge: string[];
  payoutRef?: string[];
}

export const DEFAULT_COURIER_MAPPINGS: Record<string, CourierColumnMapping> = {
  steadfast: {
    consignmentNo: ["consignment_id", "cid", "tracking_code", "consignment_no", "invoice", "consignment"],
    collectedAmount: ["cod_amount", "collected_amount", "collected", "collected_paisa", "cod"],
    deliveryCharge: ["delivery_charge", "delivery_fee", "delivery_charge_paisa"],
    codCharge: ["cod_charge", "cod_fee", "cod_charge_paisa"],
    returnCharge: ["return_charge", "rto_charge", "return_charge_paisa"],
    payoutRef: ["payout_ref", "payout_id", "statement_id", "invoice_no"],
  },
  pathao: {
    consignmentNo: ["consignment_id", "tracking_id", "consignment_no", "tracking_code"],
    collectedAmount: ["collected_amount", "cash_collected", "collected_paisa", "cod_amount"],
    deliveryCharge: ["delivery_fee", "delivery_charge", "delivery_charge_paisa"],
    codCharge: ["cod_fee", "cod_charge", "cod_charge_paisa"],
    returnCharge: ["return_fee", "return_charge", "return_charge_paisa"],
    payoutRef: ["payout_ref", "batch_id", "payout_id"],
  },
  redx: {
    consignmentNo: ["tracking_id", "tracking_code", "consignment_no", "consignment_id"],
    collectedAmount: ["cash_collection", "collected_amount", "collected_paisa", "cod_amount"],
    deliveryCharge: ["delivery_charge", "charge", "delivery_charge_paisa"],
    codCharge: ["cod_charge", "cod_fee", "cod_charge_paisa"],
    returnCharge: ["return_charge", "rto_charge", "return_charge_paisa"],
    payoutRef: ["payout_ref", "settlement_id"],
  },
  default: {
    consignmentNo: ["consignment_no", "consignment_id", "tracking_code", "tracking_id", "invoice"],
    collectedAmount: ["collected_amount", "cod_amount", "collected_paisa", "collected", "cash_collection"],
    deliveryCharge: ["delivery_charge", "delivery_fee", "delivery_charge_paisa"],
    codCharge: ["cod_charge", "cod_fee", "cod_charge_paisa"],
    returnCharge: ["return_charge", "rto_charge", "return_fee", "return_charge_paisa"],
    payoutRef: ["payout_ref", "payout_id", "settlement_id", "batch_id"],
  },
};

export interface NormalizedSettlementLine {
  consignmentNo: string;
  collectedPaisa: number;
  deliveryChargePaisa: number;
  codChargePaisa: number;
  returnChargePaisa: number;
  payoutRef?: string;
  raw: ParsedCsvRow;
}

/**
 * Extracts normalized settlement lines from parsed CSV rows using the courier mapping.
 */
export function extractCourierLines(
  rows: ParsedCsvRow[],
  courierCode: string,
  customMapping?: Partial<CourierColumnMapping>
): NormalizedSettlementLine[] {
  const normCourier = courierCode.toLowerCase().trim();
  const baseMapping = DEFAULT_COURIER_MAPPINGS[normCourier] || DEFAULT_COURIER_MAPPINGS.default;
  const mapping: CourierColumnMapping = {
    ...baseMapping,
    ...customMapping,
  };

  function findField(row: ParsedCsvRow, candidateKeys: string[]): { key: string; val: string } | null {
    for (const key of candidateKeys) {
      const normalizedKey = key.toLowerCase().trim().replace(/[\s\-_]+/g, "_");
      if (row[normalizedKey] !== undefined && row[normalizedKey] !== "") {
        return { key: normalizedKey, val: row[normalizedKey] };
      }
    }
    // Also try partial match
    for (const rowKey of Object.keys(row)) {
      for (const cand of candidateKeys) {
        if (rowKey.includes(cand)) {
          return { key: rowKey, val: row[rowKey] };
        }
      }
    }
    return null;
  }

  const lines: NormalizedSettlementLine[] = [];

  for (const row of rows) {
    const consignmentMatch = findField(row, mapping.consignmentNo);
    if (!consignmentMatch || !consignmentMatch.val) continue;

    const collectedMatch = findField(row, mapping.collectedAmount);
    const deliveryMatch = findField(row, mapping.deliveryCharge);
    const codMatch = findField(row, mapping.codCharge);
    const returnMatch = findField(row, mapping.returnCharge);
    const payoutMatch = mapping.payoutRef ? findField(row, mapping.payoutRef) : null;

    const collectedPaisa = collectedMatch
      ? parseAmountToPaisa(collectedMatch.val, collectedMatch.key)
      : 0;
    const deliveryChargePaisa = deliveryMatch
      ? parseAmountToPaisa(deliveryMatch.val, deliveryMatch.key)
      : 0;
    const codChargePaisa = codMatch
      ? parseAmountToPaisa(codMatch.val, codMatch.key)
      : 0;
    const returnChargePaisa = returnMatch
      ? parseAmountToPaisa(returnMatch.val, returnMatch.key)
      : 0;

    lines.push({
      consignmentNo: consignmentMatch.val.trim(),
      collectedPaisa,
      deliveryChargePaisa,
      codChargePaisa,
      returnChargePaisa,
      payoutRef: payoutMatch?.val?.trim(),
      raw: row,
    });
  }

  return lines;
}

export interface NormalizedGatewayLine {
  tranId: string;
  amountPaisa: number;
  feePaisa: number;
  netPaisa: number;
  payoutRef?: string;
  raw: ParsedCsvRow;
}

/**
 * Extracts SSLCommerz gateway settlement lines from parsed CSV rows.
 */
export function extractGatewayLines(rows: ParsedCsvRow[]): NormalizedGatewayLine[] {
  const tranIdKeys = ["tran_id", "transaction_id", "txnid", "tranid", "mer_txnid", "bank_tran_id"];
  const amountKeys = ["amount", "tran_amount", "gross_amount", "amount_paisa", "total_amount"];
  const feeKeys = ["bank_fee", "fee", "gateway_fee", "mdr", "fee_paisa", "charges"];
  const netKeys = ["net_amount", "payable_amount", "net_paisa", "settled_amount"];
  const payoutKeys = ["payout_ref", "settlement_id", "batch_no", "batch_id", "file_name"];

  function findField(row: ParsedCsvRow, candidateKeys: string[]): { key: string; val: string } | null {
    for (const key of candidateKeys) {
      const normalizedKey = key.toLowerCase().trim().replace(/[\s\-_]+/g, "_");
      if (row[normalizedKey] !== undefined && row[normalizedKey] !== "") {
        return { key: normalizedKey, val: row[normalizedKey] };
      }
    }
    for (const rowKey of Object.keys(row)) {
      for (const cand of candidateKeys) {
        if (rowKey.includes(cand)) {
          return { key: rowKey, val: row[rowKey] };
        }
      }
    }
    return null;
  }

  const lines: NormalizedGatewayLine[] = [];

  for (const row of rows) {
    const tranMatch = findField(row, tranIdKeys);
    if (!tranMatch || !tranMatch.val) continue;

    const amountMatch = findField(row, amountKeys);
    const feeMatch = findField(row, feeKeys);
    const netMatch = findField(row, netKeys);
    const payoutMatch = findField(row, payoutKeys);

    const amountPaisa = amountMatch ? parseAmountToPaisa(amountMatch.val, amountMatch.key) : 0;
    const feePaisa = feeMatch ? parseAmountToPaisa(feeMatch.val, feeMatch.key) : 0;
    let netPaisa = netMatch ? parseAmountToPaisa(netMatch.val, netMatch.key) : 0;
    if (netPaisa === 0 && amountPaisa > 0) {
      netPaisa = amountPaisa - feePaisa;
    }

    lines.push({
      tranId: tranMatch.val.trim(),
      amountPaisa,
      feePaisa,
      netPaisa,
      payoutRef: payoutMatch?.val?.trim(),
      raw: row,
    });
  }

  return lines;
}
