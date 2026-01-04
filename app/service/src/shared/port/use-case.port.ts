import type { Result } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";

export interface UseCasePort<TInput, TOutput> {
  execute(
    ctx: AppContext,
    input: TInput,
  ): Promise<Result<TOutput, AppError>> | Result<TOutput, AppError>;
}
