export type SupportedLocale = "en" | "bn";

export const BENGALI_DIGITS: Record<string, string> = {
  "0": "০",
  "1": "১",
  "2": "২",
  "3": "৩",
  "4": "৪",
  "5": "৫",
  "6": "৬",
  "7": "৭",
  "8": "৮",
  "9": "৯",
};

export const ENGLISH_DIGITS: Record<string, string> = {
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
 * Converts English digits (0-9) to Bengali digits (০-৯)
 */
export function toBengaliDigits(input: string | number): string {
  const str = String(input);
  return str.replace(/[0-9]/g, (digit) => BENGALI_DIGITS[digit] ?? digit);
}

/**
 * Converts Bengali digits (০-৯) to English digits (0-9)
 */
export function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (digit) => ENGLISH_DIGITS[digit] ?? digit);
}

/**
 * Formats a localized number string (e.g. 142 -> "142" or "১৪২")
 */
export function formatLocalizedNumber(num: number | string, locale: SupportedLocale = "en"): string {
  const numStr = String(num);
  if (locale === "bn") {
    return toBengaliDigits(numStr);
  }
  return numStr;
}

/**
 * Formats integer Paisa into localized BDT currency string
 * (e.g. 185000 paisa -> "৳1,850.00" in English, "৳১,৮৫০.০০" in Bengali)
 */
export function formatLocalizedPaisa(paisa: number, locale: SupportedLocale = "en"): string {
  const isNegative = paisa < 0;
  const absPaisa = Math.abs(paisa);
  const integerPart = Math.floor(absPaisa / 100);
  const fractionalPart = absPaisa % 100;

  // Format with standard thousands separator
  const formattedInt = integerPart.toLocaleString("en-US");
  const formattedFraction = fractionalPart.toString().padStart(2, "0");
  const rawFormatted = `${isNegative ? "-" : ""}৳${formattedInt}.${formattedFraction}`;

  if (locale === "bn") {
    return toBengaliDigits(rawFormatted);
  }
  return rawFormatted;
}

/**
 * Storefront Bilingual Translation Dictionary
 */
export const STOREFRONT_DICTIONARY = {
  // Navigation & Shell
  "nav.skipToContent": {
    en: "Skip to main content",
    bn: "মূল বিষয়বস্তুতে যান",
  },
  "nav.home": {
    en: "Home",
    bn: "হোম",
  },
  "nav.products": {
    en: "Products",
    bn: "পণ্যসমূহ",
  },
  "nav.preorders": {
    en: "Pre-Orders",
    bn: "প্রি-অর্ডার",
  },
  "nav.verify": {
    en: "Verify Seal",
    bn: "হলোগ্রাম যাচাই",
  },
  "nav.cart": {
    en: "Cart",
    bn: "কার্ট",
  },
  "nav.account": {
    en: "Account",
    bn: "অ্যাকাউন্ট",
  },
  "nav.search": {
    en: "Search products, SKUs, wholesale stalls...",
    bn: "পণ্য, এসকেইউ বা পাইকারি দোকান খুঁজুন...",
  },

  // Trust & Value Pillars
  "trust.authentic": {
    en: "100% Authentic Guaranteed",
    bn: "১০০% আসল ও খাঁটি পণ্যের নিশ্চয়তা",
  },
  "trust.budget": {
    en: "Budget Smart Tested OEM",
    bn: "বাজেট স্মার্ট ল্যাব-পরীক্ষিত ওইএম",
  },
  "trust.nawabpur": {
    en: "Direct from Nawabpur Wholesale Alleys",
    bn: "নবাবপুর ইলেকট্রিক্যাল পাইকারি মার্কেট থেকে সরাসরি",
  },
  "trust.hologram": {
    en: "Tamper-Evident Holographic Seal",
    bn: "নিরাপদ টেম্পার-প্রুফ হলোগ্রাম সিল",
  },

  // Actions & Buttons
  "btn.addToCart": {
    en: "Add to Cart",
    bn: "কার্টে যোগ করুন",
  },
  "btn.buyNow": {
    en: "Buy Now",
    bn: "এখনই কিনুন",
  },
  "btn.checkout": {
    en: "Proceed to Checkout",
    bn: "চেকআউটে এগিয়ে যান",
  },
  "btn.trackOrder": {
    en: "Track Live Delivery",
    bn: "লাইভ ডেলিভারি ট্র্যাক করুন",
  },
  "btn.confirmOrder": {
    en: "Confirm & Place Order",
    bn: "অর্ডার নিশ্চিত করুন",
  },

  // Accessibility Announcements
  "a11y.languageSelector": {
    en: "Select interface language",
    bn: "ওয়েবসাইট ভাষা নির্বাচন করুন",
  },
  "a11y.cartDrawerOpened": {
    en: "Shopping cart drawer opened",
    bn: "শপিং কার্ট ড্রয়ার খোলা হয়েছে",
  },
  "a11y.searchModalOpened": {
    en: "Spotlight search modal opened",
    bn: "স্পটলাইট সার্চ খোলা হয়েছে",
  },
} as const;

export type TranslationKey = keyof typeof STOREFRONT_DICTIONARY;

/**
 * Translation helper with fallback to English
 */
export function t(key: TranslationKey | string, locale: SupportedLocale = "en"): string {
  const item = (STOREFRONT_DICTIONARY as Record<string, { en: string; bn: string }>)[key];
  if (!item) return key;
  return item[locale] || item.en || key;
}
