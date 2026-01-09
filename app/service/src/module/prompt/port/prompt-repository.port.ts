import type { Result } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";
import type { Id } from "@/shared/core/id";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";

export type SearchPromptsQuery = {
  query: string;
  limit?: number;
};

export type SearchPromptsResult = {
  prompts: PromptAggregate[];
  total: number;
};

export type CounterUpdates = {
  upvotes?: number;
  downvotes?: number;
  usedCount?: number;
};

export interface PromptRepositoryPort {
  insertOne(
    ctx: AppContext,
    data: PromptAggregate,
  ): Promise<Result<PromptAggregate, AppError>>;

  findById(
    ctx: AppContext,
    id: Id,
  ): Promise<Result<PromptAggregate | null, AppError>>;

  findMany(ctx: AppContext): Promise<Result<PromptAggregate[], AppError>>;

  search(
    ctx: AppContext,
    query: SearchPromptsQuery,
  ): Promise<Result<SearchPromptsResult, AppError>>;

  updateCounters(
    ctx: AppContext,
    id: Id,
    updates: CounterUpdates,
  ): Promise<Result<void, AppError>>;

  incrementUsedCount(
    ctx: AppContext,
    id: Id,
  ): Promise<Result<number, AppError>>;
}
