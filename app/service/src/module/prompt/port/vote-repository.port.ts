import type { Result } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";
import type { Id } from "@/shared/core/id";
import type { VoteAggregate } from "@/module/prompt/domain/aggregate/vote.aggregate";

export interface VoteRepositoryPort {
  insertOne(
    ctx: AppContext,
    data: VoteAggregate,
  ): Promise<Result<VoteAggregate, AppError>>;

  findByPromptAndUser(
    ctx: AppContext,
    promptId: Id,
    userId: string,
  ): Promise<Result<VoteAggregate | null, AppError>>;

  updateOne(
    ctx: AppContext,
    data: VoteAggregate,
  ): Promise<Result<void, AppError>>;

  deleteOne(ctx: AppContext, id: Id): Promise<Result<void, AppError>>;
}
