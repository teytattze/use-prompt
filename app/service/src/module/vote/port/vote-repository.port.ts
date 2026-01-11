import type { Result } from "neverthrow";
import type { VoteAggregate } from "@/module/vote/domain/aggregate/vote.aggregate";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";

export interface VoteRepositoryPort {
  /**
   * Inserts a new vote into the repository.
   */
  insertOne(
    ctx: AppContext,
    vote: VoteAggregate,
  ): Promise<Result<VoteAggregate, AppError>>;

  /**
   * Finds a vote by prompt ID and user ID.
   * Returns null if no vote exists.
   */
  findByPromptAndUser(
    ctx: AppContext,
    params: {
      promptId: string;
      userId: string;
    },
  ): Promise<Result<VoteAggregate | null, AppError>>;

  /**
   * Updates an existing vote.
   */
  updateOne(
    ctx: AppContext,
    vote: VoteAggregate,
  ): Promise<Result<VoteAggregate, AppError>>;

  /**
   * Deletes a vote by prompt ID and user ID.
   */
  deleteOne(
    ctx: AppContext,
    params: {
      promptId: string;
      userId: string;
    },
  ): Promise<Result<void, AppError>>;

  /**
   * Calculates the sum of all vote values for a given prompt (prompt aura).
   */
  sumByPromptId(
    ctx: AppContext,
    promptId: string,
  ): Promise<Result<number, AppError>>;

  /**
   * Calculates the sum of all vote values for prompts by a given author (user aura).
   */
  sumByAuthorId(
    ctx: AppContext,
    authorId: string,
  ): Promise<Result<number, AppError>>;
}
