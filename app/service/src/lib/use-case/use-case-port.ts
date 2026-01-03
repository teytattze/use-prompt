import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";

export interface UseCasePort<TInput, TOutput> {
  execute(
    ctx: AppContext,
    input: TInput,
  ): Promise<Result<TOutput, AppError>> | Result<TOutput, AppError>;
}
