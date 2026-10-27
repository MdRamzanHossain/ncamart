export interface ReviewAttributeScores {
  buildQuality: number; // 1-5
  accuracy: number; // 1-5
  valueForMoney: number; // 1-5
}

export interface ReviewItem {
  id: string;
  authorName: string;
  authorInitials: string;
  rating: number; // 1-5
  title: string;
  body: string;
  verifiedPurchase: boolean;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  createdAt: string;
  helpfulCount: number;
  hasVotedHelpful?: boolean;
  images?: string[];
  attributes?: ReviewAttributeScores;
}

export interface RatingHistogram {
  5: number;
  4: number;
  3: number;
  2: number;
  1: number;
}

export interface ReviewSummaryData {
  averageRating: number;
  totalReviews: number;
  histogram: RatingHistogram;
  attributeAverages: ReviewAttributeScores;
}
