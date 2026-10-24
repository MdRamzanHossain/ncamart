/**
 * Synonyms and query normalization for search module (Bangla, English, Banglish).
 * PRD §3.16.1 / P12
 */

export const BANGLA_DIGIT_MAP: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

/**
 * Normalizes all Bangla numerals (০-৯) to Latin digits (0-9).
 */
export function normalizeBanglaDigits(input: string): string {
  return input.replace(/[০-৯]/g, (char) => BANGLA_DIGIT_MAP[char] ?? char);
}

/**
 * Common technical unit mappings from Bangla to standard Latin abbreviations/terms.
 */
const BANGLA_UNIT_REPLACEMENTS: Array<[RegExp, string]> = [
  // Watt: ওয়াট, ওয়াট, watt
  [/(?:ওয়াট|ওয়াট|ওয়াত|ওয়াত)(?=$|[\s,.\-!]|[^\u0980-\u09FF])/gi, "w"],
  // Volt: ভোল্ট, ভোল্টেজ
  [/(?:ভোল্টেজ|ভোল্ট)(?=$|[\s,.\-!]|[^\u0980-\u09FF])/gi, "v"],
  // Ampere / mAh: অ্যাম্পিয়ার, অ্যাম্প, এমএএইচ, ইত্যাদি
  [/(?:অ্যাম্পিয়ার|এম্পিয়ার|অ্যাম্প|এম্প)(?=$|[\s,.\-!]|[^\u0980-\u09FF])/gi, "a"],
  [/(?:এমএএইচ|এমএইচ)(?=$|[\s,.\-!]|[^\u0980-\u09FF])/gi, "mah"],
  // Meter: মিটার
  [/(?:মিটার)(?=$|[\s,.\-!]|[^\u0980-\u09FF])/gi, "m"],
  // Kilogram / Gram: কেজি, গ্রাম
  [/(?:কেজি|কিলোগ্রাম)(?=$|[\s,.\-!]|[^\u0980-\u09FF])/gi, "kg"],
  [/(?:গ্রাম)(?=$|[\s,.\-!]|[^\u0980-\u09FF])/gi, "g"],
  // Gigabyte: জিবি
  [/(?:জিবি)(?=$|[\s,.\-!]|[^\u0980-\u09FF])/gi, "gb"],
];

/**
 * Normalizes a user query:
 * 1. Converts Bangla digits to Latin digits.
 * 2. Normalizes technical units (e.g. "৬৫ ওয়াট" -> "65 w").
 * 3. Trims and collapses multiple spaces.
 */
export function normalizeSearchQuery(query: string): string {
  if (!query) return "";

  // 1. Normalize Bangla numerals to Latin
  let normalized = normalizeBanglaDigits(query);

  // 2. Normalize technical unit terms
  for (const [regex, replacement] of BANGLA_UNIT_REPLACEMENTS) {
    normalized = normalized.replace(regex, replacement);
  }

  // 3. Clean up whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Synonyms groups (bn ↔ en ↔ Banglish).
 * Each array represents an equivalence class where every term is a synonym of the others.
 */
export const SYNONYM_GROUPS: string[][] = [
  // চার্জার ↔ charger ↔ charjar
  ["charger", "চার্জার", "charjar", "chargar"],
  // ক্যাবল ↔ cable ↔ kebol
  ["cable", "ক্যাবল", "kebol", "kabol", "wire", "কর্ড"],
  // পাওয়ার ব্যাংক ↔ power bank ↔ powerbank
  ["power bank", "পাওয়ার ব্যাংক", "পাওয়ার ব্যাংক", "powerbank", "power-bank"],
  // হেডফোন ↔ headphone
  ["headphone", "হেডফোন", "head phone", "hedfon", "earphone", "ইয়ারফোন", "ইয়ারফোন"],
  // ইয়ারবাড ↔ earbuds ↔ airbuds
  ["earbuds", "ইয়ারবাড", "ইয়ারবাড", "airbuds", "earbud", "airpod", "airpods"],
  // মাল্টিমিটার ↔ multimeter
  ["multimeter", "মাল্টিমিটার", "multi meter", "maltimitar"],
  // স্মার্ট লক ↔ smart lock
  ["smart lock", "স্মার্ট লক", "smartlock", "smart-lock"],
  // অ্যাডাপ্টার ↔ adapter
  ["adapter", "অ্যাডাপ্টার", "এডাপ্টার", "adapta"],
  // ব্যাটারি ↔ battery
  ["battery", "ব্যাটারি", "betari"],
  // ডিসপ্লে ↔ display ↔ screen
  ["display", "ডিসপ্লে", "স্ক্রিন", "screen"],
  // সোল্ডারিং ↔ soldering
  ["soldering", "সোল্ডারিং", "ঝালাই", "sholdering"],
  // কনভার্টার ↔ converter
  ["converter", "কনভার্টার"],
  // ইনভার্টার ↔ inverter
  ["inverter", "ইনভার্টার"],
  // টেস্টার ↔ tester
  ["tester", "টেস্টার"],
];

/**
 * Builds a bidirectional Meilisearch synonyms mapping:
 * { "word": ["synonym1", "synonym2"] }
 */
export function buildMeiliSynonyms(groups: string[][]): Record<string, string[]> {
  const result: Record<string, Set<string>> = {};

  for (const group of groups) {
    for (const term of group) {
      const lowerTerm = term.toLowerCase().trim();
      if (!result[lowerTerm]) {
        result[lowerTerm] = new Set<string>();
      }
      for (const syn of group) {
        const lowerSyn = syn.toLowerCase().trim();
        if (lowerSyn !== lowerTerm) {
          result[lowerTerm].add(lowerSyn);
        }
      }
    }
  }

  const finalized: Record<string, string[]> = {};
  for (const [key, set] of Object.entries(result)) {
    finalized[key] = Array.from(set);
  }
  return finalized;
}

export const SEARCH_SYNONYMS = buildMeiliSynonyms(SYNONYM_GROUPS);
