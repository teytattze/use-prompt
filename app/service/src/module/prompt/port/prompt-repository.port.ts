import type { Result } from "neverthrow";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { CategoryInput } from "@/module/prompt/domain/value-object/category.value-object";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";

export type SearchPromptsQuery = {
  query: string;
  limit?: number;
};

export type SearchPromptsResult = {
  prompts: PromptAggregate[];
  total: number;
};

/**
 * Filter options for browse queries.
 */
export type BrowseFilter = {
  category?: CategoryInput;
  tags?: string[]; // Match ANY of the specified tags
};

/**
 * Trending prompt result with computed score.
 */
export type TrendingPromptResult = {
  prompt: PromptAggregate;
  aura: number;
  score: number;
};

/**
 * Prompt result with aura.
 */
export type PromptWithAuraResult = {
  prompt: PromptAggregate;
  aura: number;
};

/**
 * Search result with aura and search score.
 */
export type SearchPromptResult = {
  prompt: PromptAggregate;
  aura: number;
  searchScore: number;
};

/**
 * Facet counts for search results.
 */
export type SearchFacets = {
  categories: Record<string, number>;
  tags: Record<string, number>;
};

/**
 * Parameters for trending query.
 */
export type FindTrendingParams = {
  filter?: BrowseFilter;
  pagination: PaginationParams;
  gravity?: number; // Default 1.5
};

/**
 * Parameters for recent query.
 */
export type FindRecentParams = {
  filter?: BrowseFilter;
  pagination: PaginationParams;
};

/**
 * Parameters for text search query.
 */
export type SearchByTextParams = {
  query: string;
  filter?: BrowseFilter;
  pagination: PaginationParams;
};

/**
 * Search by text result with facets.
 */
export type SearchByTextResult = {
  items: SearchPromptResult[];
  cursor: string | null;
  hasMore: boolean;
  facets: SearchFacets;
};

/**
 * Pagination parameters for cursor-based pagination.
 */
export type PaginationParams = {
  cursor?: string;
  limit: number;
};

/**
 * Paginated result containing items and pagination metadata.
 */
export type PaginatedResult<T> = {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
};

/**
 * Parameters for finding prompts by author.
 */
export type FindByAuthorParams = {
  authorId: string;
  includeArchived: boolean;
  pagination: PaginationParams;
};

export interface PromptRepositoryPort {
  insertOne(
    ctx: AppContext,
    data: PromptAggregate,
  ): Promise<Result<PromptAggregate, AppError>>;

  findById(
    ctx: AppContext,
    id: string,
  ): Promise<Result<PromptAggregate | null, AppError>>;

  findMany(ctx: AppContext): Promise<Result<PromptAggregate[], AppError>>;

  search(
    ctx: AppContext,
    query: SearchPromptsQuery,
  ): Promise<Result<SearchPromptsResult, AppError>>;

  /**
   * Finds prompts by author with optional archive filter and pagination.
   */
  findByAuthor(
    ctx: AppContext,
    params: FindByAuthorParams,
  ): Promise<Result<PaginatedResult<PromptAggregate>, AppError>>;

  /**
   * Updates the archivedAt timestamp for a prompt.
   */
  updateArchivedAt(
    ctx: AppContext,
    params: {
      id: string;
      archivedAt: Date;
    },
  ): Promise<Result<void, AppError>>;

  /**
   * Find trending prompts with time-decayed scoring.
   * Score = aura / (hoursAge + 2)^gravity
   */
  findTrending(
    ctx: AppContext,
    params: FindTrendingParams,
  ): Promise<Result<PaginatedResult<TrendingPromptResult>, AppError>>;

  /**
   * Find recent prompts sorted by createdAt descending.
   */
  findRecent(
    ctx: AppContext,
    params: FindRecentParams,
  ): Promise<Result<PaginatedResult<PromptWithAuraResult>, AppError>>;

  /**
   * Full-text search with Atlas Search including facets.
   */
  searchByText(
    ctx: AppContext,
    params: SearchByTextParams,
  ): Promise<Result<SearchByTextResult, AppError>>;
}
