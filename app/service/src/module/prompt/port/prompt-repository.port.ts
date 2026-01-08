import type { Result } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";

export type SearchPromptsQuery = {
  query: string;
  limit?: number;
};

export type SearchPromptsResult = {
  prompts: PromptAggregate[];
  total: number;
};

export interface PromptRepositoryPort {
  insertOne(
    ctx: AppContext,
    data: PromptAggregate,
  ): Promise<Result<PromptAggregate, AppError>>;

  findMany(ctx: AppContext): Promise<Result<PromptAggregate[], AppError>>;

  search(
    ctx: AppContext,
    query: SearchPromptsQuery,
  ): Promise<Result<SearchPromptsResult, AppError>>;
}
