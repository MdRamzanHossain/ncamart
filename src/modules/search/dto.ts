import { z } from "zod";
import { productTierEnum, fulfillmentTypeEnum } from "@/modules/catalog";

export const searchQueryParamsSchema = z.object({
  q: z.string().optional().default(""),
  tier: z.enum(productTierEnum).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  fulfillment: z.enum(fulfillmentTypeEnum).optional(),
  availability: z
    .enum(["IN_STOCK", "AVAILABLE", "OUT_OF_STOCK", "PRE_ORDER", "ANY"])
    .optional(),
  min_price: z.coerce.number().int().nonnegative().optional(),
  max_price: z.coerce.number().int().positive().optional(),
  sort: z.enum(["PRICE_ASC", "PRICE_DESC", "NEWEST"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type SearchQueryParams = z.input<typeof searchQueryParamsSchema>;

export interface ProductSearchDocument {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  brand: string;
  category_ids: string[];
  category_path_en: string;
  category_path_bn: string;
  tier: string;
  fulfillment_type: string;
  min_price_paisa: number;
  availability: string;
  spec_keywords: string[];
  sku_codes: string[];
  published_at: number; // Unix timestamp (ms)
}

export interface SearchFacetDistribution {
  tier: Record<string, number>;
  brand: Record<string, number>;
  category: Record<string, number>;
}

export interface SearchPagination {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface SearchResult {
  hits: Array<ProductSearchDocument & { _formatted?: Partial<ProductSearchDocument> }>;
  facets: SearchFacetDistribution;
  pagination: SearchPagination;
}
