export interface SeedComparisonGroupDefinition {
  name: string;
  slug: string;
  categorySlug: string;
  verdictEn: string;
  verdictBn: string;
  badgeAuthenticLabel: string;
  badgeBudgetLabel: string;
}

export const SEED_COMPARISON_GROUPS: SeedComparisonGroupDefinition[] = [
  {
    name: "65W GaN Fast Chargers",
    slug: "65w-gan-chargers",
    categorySlug: "mobile-laptop-accessories",
    verdictEn:
      "Authentic delivers multi-protocol GaN III with certified over-voltage protection and 1-year replacement warranty; Budget Smart provides reliable everyday 65W charging with tested thermal cutoff at 50% lower cost.",
    verdictBn:
      "অথেনটিক ভ্যারিয়েন্টে রয়েছে সার্টিফাইড GaN III ওভার-ভোল্টেজ প্রটেকশন ও ১ বছরের ওয়ারেন্টি; বাজেট স্মার্ট ভ্যারিয়েন্ট অর্ধেক মূল্যে নির্ভরযোগ্য ৬৫ ওয়াট চার্জিং ও টেস্টেড সেফটি অফার করে।",
    badgeAuthenticLabel: "Full Safety Suite",
    badgeBudgetLabel: "Best Everyday Value",
  },
  {
    name: "100W PD Type-C Cables",
    slug: "100w-type-c-cables",
    categorySlug: "mobile-laptop-accessories",
    verdictEn:
      "Authentic features E-Marker certified 100W throughput with zinc-alloy shielding; Budget Smart tested OEM provides high-durability braided nylon with verified 100W power delivery.",
    verdictBn:
      "অথেনটিক কেবলে রয়েছে ই-মার্কার সার্টিফাইড ১০০ ওয়াট স্পিড ও জিংক অ্যালয় বডি; বাজেট স্মার্টে মজবুত ব্রেইডেড নাইলন ও পরীক্ষিত ১০০ ওয়াট পাওয়ার ডেলিভারি।",
    badgeAuthenticLabel: "Full Safety Suite",
    badgeBudgetLabel: "Best Everyday Value",
  },
  {
    name: "ANC True Wireless Earbuds",
    slug: "anc-tws-earbuds",
    categorySlug: "audio-wearables",
    verdictEn:
      "Authentic offers hybrid -35dB ANC with multi-mic beamforming and official distributor support; Budget Smart delivers strong bass, clear calls, and dependable 25-hour playback.",
    verdictBn:
      "অথেনটিক মডেলে রয়েছে হাইব্রিড -৩৫ডিবি নয়েজ ক্যান্সেলেশন ও অফিশিয়াল ডিস্ট্রিবিউটর ওয়ারেন্টি; বাজেট স্মার্টে শক্তিশালী বাস ও দীর্ঘ ২৫ ঘণ্টার ব্যাকআপ।",
    badgeAuthenticLabel: "Full Safety Suite",
    badgeBudgetLabel: "Best Everyday Value",
  },
];
