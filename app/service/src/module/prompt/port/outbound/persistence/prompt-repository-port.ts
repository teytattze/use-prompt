import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";

export interface PromptRepositoryPort {
  insertOne(
    ctx: AppContext,
    data: PromptAggregate,
  ): Promise<Result<PromptAggregate, AppError>>;

  findMany(ctx: AppContext): Promise<Result<PromptAggregate[], AppError>>;
}
