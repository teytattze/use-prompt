import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";

export type UnitOfWorkFn<T> = (ctx: AppContext) => Promise<Result<T, AppError>>;

export interface UnitOfWorkPort {
  execute<T>(
    ctx: AppContext,
    work: UnitOfWorkFn<T>,
  ): Promise<Result<T, AppError>>;
}
